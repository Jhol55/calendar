'use client';

import React, { useState, useCallback } from 'react';
import { EdgeProps, useReactFlow } from 'reactflow';

interface CustomEdgeData {
  // Armazenar as posições relativas dos pontos de controle (0-1 relativo à distância)
  controlPoint1?: {
    offsetX: number; // Offset horizontal relativo (-1 a 1)
    offsetY: number; // Offset vertical relativo (-1 a 1)
  };
  controlPoint2?: {
    offsetX: number;
    offsetY: number;
  };
}

export default function CustomBezierEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style = {},
  markerEnd,
  data,
  selected,
}: EdgeProps<CustomEdgeData>) {
  const { setEdges } = useReactFlow();
  const [draggingCP, setDraggingCP] = useState<'cp1' | 'cp2' | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Calcular distância e vetor entre os nós
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const length = Math.sqrt(dx * dx + dy * dy);

  // Função para calcular ponto em uma curva Bezier cúbica dado t (0 a 1)
  const getBezierPoint = (
    t: number,
    sx: number,
    sy: number,
    c1x: number,
    c1y: number,
    c2x: number,
    c2y: number,
    tx: number,
    ty: number,
  ) => {
    const t2 = t * t;
    const t3 = t2 * t;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;

    return {
      x: mt3 * sx + 3 * mt2 * t * c1x + 3 * mt * t2 * c2x + t3 * tx,
      y: mt3 * sy + 3 * mt2 * t * c1y + 3 * mt * t2 * c2y + t3 * ty,
    };
  };

  // Calcular posições dos pontos de controle Bezier (INVISÍVEIS - fora da linha)
  // Se não houver customização, usar posições padrão (curva suave)
  const defaultCP1 = {
    x: sourceX + dx * 0.5,
    y: sourceY,
  };
  const defaultCP2 = {
    x: sourceX + dx * 0.5,
    y: targetY,
  };

  // Aplicar offsets customizados se existirem
  let bezierCP1X = defaultCP1.x;
  let bezierCP1Y = defaultCP1.y;
  let bezierCP2X = defaultCP2.x;
  let bezierCP2Y = defaultCP2.y;

  if (data?.controlPoint1) {
    bezierCP1X = sourceX + dx * 0.5 + data.controlPoint1.offsetX * length;
    bezierCP1Y = sourceY + dy * 0.5 + data.controlPoint1.offsetY * length;
  }

  if (data?.controlPoint2) {
    bezierCP2X = sourceX + dx * 0.5 + data.controlPoint2.offsetX * length;
    bezierCP2Y = sourceY + dy * 0.5 + data.controlPoint2.offsetY * length;
  }

  // Calcular o path da curva Bezier
  const edgePath = `M ${sourceX},${sourceY} C ${bezierCP1X},${bezierCP1Y} ${bezierCP2X},${bezierCP2Y} ${targetX},${targetY}`;

  // Calcular posições dos handles VISÍVEIS sobre a curva (em t=0.33 e t=0.67)
  const visualHandle1 = getBezierPoint(
    0.33,
    sourceX,
    sourceY,
    bezierCP1X,
    bezierCP1Y,
    bezierCP2X,
    bezierCP2Y,
    targetX,
    targetY,
  );
  const visualHandle2 = getBezierPoint(
    0.67,
    sourceX,
    sourceY,
    bezierCP1X,
    bezierCP1Y,
    bezierCP2X,
    bezierCP2Y,
    targetX,
    targetY,
  );

  // Handlers para começar a arrastar
  const handleMouseDownCP1 = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    setDraggingCP('cp1');
  }, []);

  const handleMouseDownCP2 = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    setDraggingCP('cp2');
  }, []);

  // Handler para arrastar
  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!draggingCP) return;

      // Obter posição do mouse no canvas
      const reactFlowElement = document.querySelector('.react-flow');
      if (!reactFlowElement) return;

      const rect = reactFlowElement.getBoundingClientRect();

      // Calcular posição considerando zoom e pan
      const viewport = reactFlowElement.querySelector(
        '.react-flow__viewport',
      ) as HTMLElement;
      if (!viewport) return;

      const transform = viewport.style.transform;
      const match = transform.match(
        /translate\(([-\d.]+)px,\s*([-\d.]+)px\)\s*scale\(([-\d.]+)\)/,
      );

      let translateX = 0;
      let translateY = 0;
      let scale = 1;

      if (match) {
        translateX = parseFloat(match[1]);
        translateY = parseFloat(match[2]);
        scale = parseFloat(match[3]);
      }

      const mouseX = (event.clientX - rect.left - translateX) / scale;
      const mouseY = (event.clientY - rect.top - translateY) / scale;

      setEdges((edges) =>
        edges.map((edge) => {
          if (edge.id === id) {
            const newData = { ...edge.data };

            const edgeDx = targetX - sourceX;
            const edgeDy = targetY - sourceY;
            const edgeLength = Math.sqrt(edgeDx * edgeDx + edgeDy * edgeDy);

            if (edgeLength === 0) return edge;

            // Calcular onde o handle visível está agora (posição do mouse)
            // e mapear isso para um offset do ponto de controle Bezier

            // Calcular offset relativo ao ponto médio
            const midX = sourceX + edgeDx * 0.5;
            const midY = sourceY + edgeDy * 0.5;

            // Vetor do mouse relativo ao ponto médio
            const handleDx = mouseX - midX;
            const handleDy = mouseY - midY;

            // Fator de amplificação: quanto o ponto de controle Bezier
            // precisa se mover para que o handle visível fique no mouse
            // Empiricamente, um fator de ~1.5 funciona bem para t=0.33 e t=0.67
            const amplificationFactor = 1.8;

            const offsetX = (handleDx * amplificationFactor) / edgeLength;
            const offsetY = (handleDy * amplificationFactor) / edgeLength;

            if (draggingCP === 'cp1') {
              newData.controlPoint1 = { offsetX, offsetY };
            } else if (draggingCP === 'cp2') {
              newData.controlPoint2 = { offsetX, offsetY };
            }

            return { ...edge, data: newData };
          }
          return edge;
        }),
      );
    },
    [id, draggingCP, sourceX, sourceY, targetX, targetY, setEdges],
  );

  // Handler para soltar
  const handleMouseUp = useCallback(() => {
    setDraggingCP(null);
  }, []);

  // Adicionar event listeners
  React.useEffect(() => {
    if (draggingCP) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [draggingCP, handleMouseMove, handleMouseUp]);

  // Mostrar controles apenas se: estiver selecionada, em hover, ou arrastando
  const showControls = selected || isHovered || draggingCP !== null;

  return (
    <g
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Path principal da edge */}
      <path
        id={id}
        style={style}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
        fill="none"
      />

      {/* Área de hover maior para facilitar */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        style={{ pointerEvents: 'stroke' }}
      />

      {showControls && (
        <>
          {/* Handle VISÍVEL 1 - sobre a curva */}
          <g
            onMouseDown={handleMouseDownCP1}
            style={{ cursor: draggingCP === 'cp1' ? 'grabbing' : 'grab' }}
            className="nodrag nopan"
          >
            <circle
              cx={visualHandle1.x}
              cy={visualHandle1.y}
              r={12}
              fill="transparent"
              style={{ pointerEvents: 'all' }}
            />
            <circle
              cx={visualHandle1.x}
              cy={visualHandle1.y}
              r={7}
              fill="white"
              style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.2))' }}
            />
            <circle
              cx={visualHandle1.x}
              cy={visualHandle1.y}
              r={5}
              fill={draggingCP === 'cp1' ? '#3b82f6' : '#64748b'}
              style={{
                transition: draggingCP === 'cp1' ? 'none' : 'fill 0.2s',
              }}
            />
          </g>

          {/* Handle VISÍVEL 2 - sobre a curva */}
          <g
            onMouseDown={handleMouseDownCP2}
            style={{ cursor: draggingCP === 'cp2' ? 'grabbing' : 'grab' }}
            className="nodrag nopan"
          >
            <circle
              cx={visualHandle2.x}
              cy={visualHandle2.y}
              r={12}
              fill="transparent"
              style={{ pointerEvents: 'all' }}
            />
            <circle
              cx={visualHandle2.x}
              cy={visualHandle2.y}
              r={7}
              fill="white"
              style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.2))' }}
            />
            <circle
              cx={visualHandle2.x}
              cy={visualHandle2.y}
              r={5}
              fill={draggingCP === 'cp2' ? '#3b82f6' : '#64748b'}
              style={{
                transition: draggingCP === 'cp2' ? 'none' : 'fill 0.2s',
              }}
            />
          </g>
        </>
      )}
    </g>
  );
}
