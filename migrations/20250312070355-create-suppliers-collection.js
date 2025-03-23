// migrations/20230313093000-create-suppliers-collection.js

module.exports = {
  up: async (db, client) => {
    // Membuat koleksi "suppliers" jika belum ada
    const suppliersCollection = db.collection('suppliers');

    // Membuat indeks untuk field "id" agar unik
    await suppliersCollection.createIndex({ nama: 1 }, { unique: true });

    // Anda bisa menambahkan data contoh jika diperlukan (misalnya untuk testing)
    await suppliersCollection.insertOne({
      nama: 'Satkomindo',      // Kolom nama
      urlFoto: '',      // Kolom nama
      created_at: new Date(), // Kolom created_at
      updated_at: new Date(), // Kolom updated_at
    });
  },

  down: async (db, client) => {
    // Rollback: menghapus koleksi "suppliers"
    const collections = await db.listCollections().toArray();
    
    if (collections.some(col => col.name === 'suppliers')) {
      await db.collection('suppliers').drop();
    }
  },
};
