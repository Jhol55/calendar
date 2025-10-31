-- Query SQL Complexa - Versão Simplificada (sem filtros restritivos)
-- Utiliza: CTEs, JOINs, Agregações Avançadas, Subqueries Correlacionadas, CASE, CAST, ORDER BY

WITH 
-- CTE 1: Estatísticas por Categoria
CategoriaStats AS (
    SELECT
        categoria,
        AVG(valor) AS media_valor,
        COUNT(*) AS total_produtos,
        MIN(valor) AS menor_valor,
        MAX(valor) AS maior_valor,
        SUM(valor) AS valor_total,
        STRING_AGG(nome, ' | ') AS produtos_ordenados
    FROM
        produtos
    WHERE
        valor IS NOT NULL AND valor > 0
    GROUP BY
        categoria
),

-- CTE 2: Produtos com Desconto Calculado
ProdutosComDesconto AS (
    SELECT
        p.nome,
        p.codigo,
        p.valor,
        p.categoria,
        CASE
            -- Simplificar condições para garantir avaliação correta
            WHEN cs.maior_valor IS NOT NULL 
                 AND cs.maior_valor > 0 
                 AND p.valor IS NOT NULL
                 AND p.valor > (cs.maior_valor * 0.9) THEN 
                p.valor * 0.85  -- 15% desconto para produtos premium
            WHEN cs.media_valor IS NOT NULL 
                 AND p.valor IS NOT NULL
                 AND p.valor > cs.media_valor THEN 
                p.valor * 0.90  -- 10% desconto para acima da média
            WHEN cs.media_valor IS NOT NULL 
                 AND p.valor IS NOT NULL
                 AND p.valor < (cs.media_valor * 0.7) THEN 
                p.valor * 0.95  -- 5% desconto para abaixo da média
            ELSE p.valor  -- Sem desconto
        END AS valor_com_desconto,
        cs.media_valor,
        cs.total_produtos,
        (p.valor - cs.media_valor) AS diferenca_da_media
    FROM
        produtos p
    INNER JOIN
        CategoriaStats cs ON p.categoria = cs.categoria
    WHERE
        p.valor IS NOT NULL AND p.valor > 0
),

-- CTE 3: Ranking de Produtos por Categoria
ProdutoRanking AS (
    SELECT
        pdc.nome,
        pdc.codigo,
        pdc.valor,
        pdc.categoria,
        pdc.valor_com_desconto,
        pdc.media_valor,
        pdc.diferenca_da_media,
        -- Subquery correlacionada: ranking dentro da categoria
        (
            SELECT COUNT(*) + 1
            FROM produtos p2
            WHERE p2.categoria = pdc.categoria
              AND p2.valor IS NOT NULL
              AND p2.valor > pdc.valor
        ) AS ranking_valor,
        -- Subquery correlacionada: verificar se é o produto mais caro da categoria
        CASE
            WHEN pdc.valor = (
                SELECT MAX(p3.valor)
                FROM produtos p3
                WHERE p3.categoria = pdc.categoria
                  AND p3.valor IS NOT NULL
            ) THEN 1
            ELSE 0
        END AS is_mais_caro
    FROM
        ProdutosComDesconto pdc
),

-- CTE 4: Análise Comparativa Final
AnaliseFinal AS (
    SELECT
        pr.nome,
        pr.codigo,
        pr.valor AS valor_original,
        pr.valor_com_desconto AS valor_desconto,
        pr.media_valor AS media_categoria,
        pr.categoria,
        pr.ranking_valor,
        pr.is_mais_caro,
        pr.diferenca_da_media,
        -- Calcular economia percentual (proteger divisão por zero e nulls)
        CASE
            WHEN pr.valor IS NOT NULL 
                 AND pr.valor > 0 
                 AND pr.valor_com_desconto IS NOT NULL THEN
                -- Calcular percentual diretamente
                ((pr.valor - pr.valor_com_desconto) / pr.valor * 100)
            ELSE 0
        END AS percentual_economia,
        -- Classificar faixa de valor
        CASE
            WHEN pr.media_valor IS NOT NULL AND pr.valor > pr.media_valor * 1.3 THEN 'Premium'
            WHEN pr.media_valor IS NOT NULL AND pr.valor > pr.media_valor THEN 'Acima da Média'
            WHEN pr.media_valor IS NOT NULL AND pr.valor > pr.media_valor * 0.7 THEN 'Na Média'
            ELSE 'Abaixo da Média'
        END AS faixa_valor,
        -- Verificar se produto está em top 3 da categoria
        CASE
            WHEN pr.ranking_valor <= 3 THEN 'Top 3'
            ELSE 'Fora do Top 3'
        END AS posicao_categoria
    FROM
        ProdutoRanking pr
)

-- Query Principal - MOSTRA TODOS OS DADOS (sem filtros restritivos)
SELECT
    pr.nome AS produto_nome,
    pr.codigo,
    pr.categoria,
    pr.valor_original,
    pr.valor_desconto,
    pr.media_categoria,
    pr.percentual_economia,
    pr.faixa_valor,
    pr.posicao_categoria,
    pr.ranking_valor,
    CASE pr.is_mais_caro
        WHEN 1 THEN 'Sim'
        ELSE 'Não'
    END AS produto_mais_caro_categoria,
    pr.diferenca_da_media
FROM
    AnaliseFinal pr
-- Comentado para mostrar todos os dados primeiro
-- WHERE
--     (
--         pr.faixa_valor IN ('Premium', 'Acima da Média')
--         OR pr.posicao_categoria = 'Top 3'
--     )
--     AND pr.valor_original > (
--         SELECT AVG(valor)
--         FROM produtos
--         WHERE valor IS NOT NULL
--     )
--     AND pr.categoria IN (
--         SELECT categoria
--         FROM produtos
--         GROUP BY categoria
--         HAVING COUNT(*) > 1
--     )
ORDER BY
    pr.categoria ASC,
    pr.valor_original DESC,
    pr.ranking_valor ASC;

