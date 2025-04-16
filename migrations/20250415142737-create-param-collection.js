module.exports = {
  up: async (db, client) => {
    const paramsCollection = db.collection('params');

    // Membuat index unik pada field 'nama'
    await paramsCollection.createIndex({ nama: 1 }, { unique: true });

    // Menambahkan 3 data awal
    await paramsCollection.insertMany([
      {
        nama: 'cikupa',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        nama: 'tongkol',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        nama: 'jonggol',
        created_at: new Date(),
        updated_at: new Date(),
      }
    ]);
  },

  down: async (db, client) => {
    const collections = await db.listCollections().toArray();

    if (collections.some(col => col.name === 'params')) {
      await db.collection('params').drop();
    }
  }
};
