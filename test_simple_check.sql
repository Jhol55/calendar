-- Query simples para verificar se a tabela produtos existe e tem dados
SELECT COUNT(*) AS total FROM produtos;

-- Ver primeiros registros
SELECT * FROM produtos LIMIT 5;

-- Verificar categorias
SELECT categoria, COUNT(*) AS total FROM produtos GROUP BY categoria;

