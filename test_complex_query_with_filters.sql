-- Query SQL Complexa - Versão COM FILTROS
-- Use esta versão se quiser aplicar filtros específicos

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
            WHEN cs.maior_valor > 0 AND p.valor > cs.maior_valor * 0.9 THEN p.valor * 0.85
            WHEN cs.media_valor IS NOT NULL AND p.valor > cs.media_valor THEN p.valor * 0.90
            WHEN cs.media_valor IS NOT NULL AND p.valor < cs.media_valor * 0.7 THEN p.valor * 0.95
            ELSE p.valor
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
        nome,
        codigo,
        valor,
        categoria,
        valor_com_desconto,
        media_valor,
        diferenca_da_media,
        (
            SELECT COUNT(*) + 1
            FROM produtos p2
            WHERE p2.categoria = ProdutosComDesconto.categoria
              AND p2.valor IS NOT NULL
              AND p2.valor > ProdutosComDesconto.valor
        ) AS ranking_valor,
        CASE
            WHEN valor = (
                SELECT MAX(p3.valor)
                FROM produtos p3
                WHERE p3.categoria = ProdutosComDesconto.categoria
                  AND p3.valor IS NOT NULL
            ) THEN 1
            ELSE 0
        END AS is_mais_caro
    FROM
        ProdutosComDesconto
),

-- CTE 4: Análise Comparativa Final
AnaliseFinal AS (
    SELECT
        pr.nome,
        pr.codigo,
        CAST(pr.valor AS NUMERIC) AS valor_original,
        CAST(pr.valor_com_desconto AS NUMERIC) AS valor_desconto,
        CAST(pr.media_valor AS NUMERIC) AS media_categoria,
        pr.categoria,
        pr.ranking_valor,
        pr.is_mais_caro,
        pr.diferenca_da_media,
        CASE
            WHEN pr.valor > 0 THEN
                CAST(
                    ((pr.valor - pr.valor_com_desconto) / pr.valor * 100) AS NUMERIC
                )
            ELSE 0
        END AS percentual_economia,
        CASE
            WHEN pr.media_valor IS NOT NULL AND pr.valor > pr.media_valor * 1.3 THEN 'Premium'
            WHEN pr.media_valor IS NOT NULL AND pr.valor > pr.media_valor THEN 'Acima da Média'
            WHEN pr.media_valor IS NOT NULL AND pr.valor > pr.media_valor * 0.7 THEN 'Na Média'
            ELSE 'Abaixo da Média'
        END AS faixa_valor,
        CASE
            WHEN pr.ranking_valor <= 3 THEN 'Top 3'
            ELSE 'Fora do Top 3'
        END AS posicao_categoria
    FROM
        ProdutoRanking pr
)

-- Query Principal COM FILTROS (descomente para usar)
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
WHERE
    -- Filtros mais flexíveis
    (
        pr.faixa_valor IN ('Premium', 'Acima da Média')
        OR pr.posicao_categoria = 'Top 3'
    )
    -- Apenas se houver produtos na tabela
    AND EXISTS (
        SELECT 1 FROM produtos WHERE valor IS NOT NULL
    )
ORDER BY
    pr.categoria ASC,
    pr.valor_original DESC,
    pr.ranking_valor ASC;

