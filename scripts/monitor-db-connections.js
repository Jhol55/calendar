#!/usr/bin/env node

/**
 * Script para monitorar conexões ativas do PostgreSQL
 * Executa: node scripts/monitor-db-connections.js
 */

const { PrismaClient } = require('../generated/prisma');

const prisma = new PrismaClient();

async function monitorConnections() {
  try {
    console.log('🔍 Monitorando conexões PostgreSQL...\n');

    const connections = await prisma.$queryRaw`
      SELECT 
        pid,
        usename,
        application_name,
        client_addr,
        state,
        query,
        state_change,
        NOW() - state_change as duration
      FROM pg_stat_activity 
      WHERE datname = 'wazzy'
      ORDER BY state_change DESC
    `;

    console.log(`📊 Total de conexões ativas: ${connections.length}\n`);

    connections.forEach((conn, idx) => {
      console.log(`\n--- Conexão ${idx + 1} ---`);
      console.log(`PID: ${conn.pid}`);
      console.log(`Usuário: ${conn.usename}`);
      console.log(`App: ${conn.application_name || 'N/A'}`);
      console.log(`Estado: ${conn.state}`);
      console.log(`Duração: ${conn.duration}`);
      console.log(`Query: ${conn.query?.substring(0, 100)}...`);
    });

    // Estatísticas gerais
    const stats = await prisma.$queryRaw`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE state = 'active') as active,
        COUNT(*) FILTER (WHERE state = 'idle') as idle,
        COUNT(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction
      FROM pg_stat_activity 
      WHERE datname = 'wazzy'
    `;

    console.log('\n\n📈 Estatísticas:');
    console.log(stats[0]);
  } catch (error) {
    console.error('❌ Erro ao monitorar conexões:', error);
  } finally {
    await prisma.$disconnect();
  }
}

monitorConnections();
