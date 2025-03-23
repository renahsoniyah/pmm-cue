module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    // Membuat koleksi "logEtalase" jika belum ada
    const logEtalaseCollection = db.collection('logetalases');

    // Anda bisa menambahkan data contoh jika diperlukan (misalnya untuk testing)
    await logEtalaseCollection.insertOne({
      nama: 'CKL (BARU)',// Kolom nama ikan
      fotoBarang: '',
      suratJalan: '',
      size: '2 UP',
      supplier: 'B-12',
      bentukBarang: 'MC', // MC(dus) / KRG / PLS
      settinganMC: 2, // kalau MC(dus) default pembelian per dus berapa kg
      jumlahKiloBefore: 100.5, // keisi case setingan MC(dus) atau karungan
      jumlahKiloAfter: 96.5, // keisi case setingan MC(dus) atau karungan
      jumlahMCPLSBefore: 10, // (jumlah MC/PLSTIK)
      jumlahMCPLSAfter: 8, // (jumlah MC/PLSTIK)
      hargaJual: 1500, // (jumlah MC/PLSTIK)
      hargaBeliSupplier: 1000, // (jumlah MC/PLSTIK)
      jumlahPembayaran: 3000, // jumlah pembayaran
      status: 'IN', // (IN / OUT)
      created_at: new Date(), // Kolom created_at
      updated_at: new Date(), // Kolom updated_at
    });

    // ,{
    //   nama: 'TUNA',// Kolom nama ikan
    //   fotoBarang: '',
    //   size: '2 UP',
    //   supplier: 'B-12',
    //   bentukBarang: 'KRG', // MC(dus) / KRG / PLS
    //   settinganMC: 0, // kalau MC(dus) default pembelian per dus berapa kg
    //   jumlahKiloBefore: 100.5, // keisi case setingan MC(dus) atau karungan
    //   jumlahKiloAfter: 96.5, // keisi case setingan MC(dus) atau karungan
    //   jumlahMCPLSBefore: 10, // (jumlah MC/PLSTIK)
    //   jumlahMCPLSAfter: 8, // (jumlah MC/PLSTIK)
    //   hargaBeliSupplier: 10000, // beli di harga
    //   created_at: new Date(), // Kolom created_at
    //   updated_at: new Date(), // Kolom updated_at
    // },{
    //   nama: 'TONGKOL',// Kolom nama ikan
    //   fotoBarang: '',
    //   size: '2 UP',
    //   supplier: 'B-12',
    //   bentukBarang: 'PLS', // MC(dus) / KRG / PLS
    //   settinganMC: 0, // kalau MC(dus) default pembelian per dus berapa kg
    //   jumlahKiloBefore: 100.5, // keisi case setingan MC(dus) atau karungan
    //   jumlahKiloAfter: 96.5, // keisi case setingan MC(dus) atau karungan
    //   jumlahMCPLSBefore: 10, // (jumlah MC/PLSTIK)
    //   jumlahMCPLSAfter: 8, // (jumlah MC/PLSTIK)
    //   hargaBeliSupplier: 10000, // beli di harga
    //   created_at: new Date(), // Kolom created_at
    //   updated_at: new Date(), // Kolom updated_at
    // }
    
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    const collections = await db.listCollections().toArray();
    
    if (collections.some(col => col.name === 'logetalases')) {
      await db.collection('logetalases').drop();
    }
  }
};