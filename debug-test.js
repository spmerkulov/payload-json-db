const { JsonAdapter } = require('./dist/index.js');

async function debugTest() {
  const adapter = new JsonAdapter({
    dbPath: './test-debug-db',
    enableCache: true,
    cacheSize: 100
  });

  try {
    await adapter.init();
    
    // Test migrations
    console.log('Testing migrations...');
    const migrations = await adapter.getMigrations();
    console.log('Current migrations:', migrations.length);
    
    // Test complex queries
    console.log('Testing complex queries...');
    const collection = `users_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create test data
    const testData = [
      { name: 'John', age: 25, active: true, tags: ['developer', 'javascript'] },
      { name: 'Jane', age: 30, active: false, tags: ['designer', 'css'] },
      { name: 'Bob', age: 35, active: true, tags: ['manager', 'javascript'] },
    ];

    for (const data of testData) {
      await adapter.create(collection, data);
    }

    // Test pagination
    const paginated = await adapter.find(collection, {
      where: {},
      limit: 2,
      page: 1,
    });

    console.log('Paginated result:', {
      docsLength: paginated.docs.length,
      totalPages: paginated.totalPages,
      totalDocs: paginated.totalDocs
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await adapter.destroy();
  }
}

debugTest();