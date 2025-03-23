module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    const etalaseCollection = db.collection('etalases');
    const supplierCollection = db.collection('suppliers');

    // Cari supplier berdasarkan nama untuk mendapatkan _id
    const supplier = await supplierCollection.findOne({ name: 'Satkomindo' });
    const supplierId = supplier ? supplier._id : null;

    // Menambahkan data contoh dengan ObjectId supplier jika ditemukan
    await etalaseCollection.insertOne({
      nama: 'CKL (BARU)',
      fotoBarang: '',
      size: '2 UP',
      supplier: supplierId, // Menggunakan ObjectId jika ditemukan
      bentukBarang: 'MC',
      noSurat: 'MC',
      settinganMC: 2,
      jumlahKilo: 100.5,
      jumlahMCPLS: 10,
      hargaJual: 15000,
      hargaBeliSupplier: 10000,
      inActiveDate: null,
      created_at: new Date(),
      updated_at: new Date(),
    });
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    const collections = await db.listCollections().toArray();
    if (collections.some(col => col.name === 'etalases')) {
      await db.collection('etalases').drop();
    }
  }
};