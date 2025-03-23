// migrations/20250312082020-create-users-collection.js

module.exports = {
  up: async (db, client) => {
    // Membuat koleksi "users" jika belum ada
    const usersCollection = db.collection('users');

    // Membuat indeks untuk field "id" agar unik
    await usersCollection.createIndex({ email: 1 }, { unique: true });

    // Anda bisa menambahkan data contoh jika diperlukan (misalnya untuk testing)
    await usersCollection.insertOne({
      email: 'JohnDoe@gmail.com',// Kolom email
      nama: 'John Doe',      // Kolom nama
      level: 'admin',        // Kolom level (admin/karyawan)
      password: 'hashed_password', // Kolom password (hashed)
      status: false,           // Kolom password (hashed)
      created_at: new Date(), // Kolom created_at
      updated_at: new Date(), // Kolom updated_at
    });
  },

  down: async (db, client) => {
    // Rollback: menghapus koleksi "users"
    const collections = await db.listCollections().toArray();
    
    if (collections.some(col => col.name === 'users')) {
      await db.collection('users').drop();
    }
  },
};