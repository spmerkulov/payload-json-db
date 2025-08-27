const { JsonAdapter } = require('./dist/index.js');
const path = require('path');
const fs = require('fs-extra');

// Mock Payload request object
const mockRequest = {
  payload: {
    config: {
      collections: [],
      globals: [],
    },
  },
};

async function testMigrations() {
  console.log('\n=== Testing Migrations ===');
  
  const migrationAdapter = new JsonAdapter({
    dbPath: `./test-migration-debug-${Date.now()}`,
    enableCache: true,
    cacheSize: 100
  });
  
  try {
    await migrationAdapter.init();
    console.log('✓ Migration adapter initialized');

    const migrationName = 'test-migration';
    
    // Create migration
    const created = await migrationAdapter.createMigration({
      name: migrationName,
      batch: 1,
    });
    console.log('✓ Migration created:', created);

    // Get migrations
    const migrations = await migrationAdapter.getMigrations();
    console.log('✓ Migrations retrieved:', migrations.length, 'migrations');
    
    if (migrations.length !== 1) {
      console.error('❌ Expected 1 migration, got:', migrations.length);
      console.log('Migrations:', migrations);
    }
    
    await migrationAdapter.destroy();
    console.log('✓ Migration adapter destroyed');
    
  } catch (error) {
    console.error('❌ Migration test failed:', error.message);
    console.error(error.stack);
  }
}

async function testTransactions() {
  console.log('\n=== Testing Transactions ===');
  
  const adapter = new JsonAdapter({
    dbPath: `./test-transaction-debug-${Date.now()}`,
    enableCache: true,
    cacheSize: 100
  });
  
  try {
    await adapter.init();
    console.log('✓ Transaction adapter initialized');

    const collection = 'transactions-test';
    
    // Begin transaction
    const transaction = await adapter.beginTransaction(mockRequest);
    console.log('✓ Transaction started:', transaction);

    // Create document within transaction
    const created = await adapter.create(collection, { name: 'Transaction Test' });
    console.log('✓ Document created in transaction:', created);

    // Commit transaction
    await adapter.commitTransaction(transaction);
    console.log('✓ Transaction committed');

    // Verify document exists after commit
    const found = await adapter.find(collection, {
      where: { id: { equals: created.id } },
    });
    console.log('✓ Document found after commit:', found.docs.length, 'docs');
    
    await adapter.destroy();
    console.log('✓ Transaction adapter destroyed');
    
  } catch (error) {
    console.error('❌ Transaction test failed:', error.message);
    console.error(error.stack);
  }
}

async function runDiagnostics() {
  console.log('Starting integration test diagnostics...');
  
  try {
    await testMigrations();
    await testTransactions();
    
    console.log('\n=== Diagnostics Complete ===');
  } catch (error) {
    console.error('❌ Diagnostics failed:', error);
  }
  
  // Force exit to avoid hanging
  process.exit(0);
}

runDiagnostics();