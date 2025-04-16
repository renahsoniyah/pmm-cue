const Param = require('../models/paramModel');

// CREATE
exports.createParam = async (req, res) => {
  try {
    const { nama } = req.body;

    const newParam = new Param({ nama });
    await newParam.save();

    res.status(201).json({ message: 'Param created successfully', data: newParam });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create param', error: error.message });
  }
};

// READ - All
exports.getAllParams = async (req, res) => {
  try {
    const params = await Param.find();
    res.status(200).json(params);
  } catch (error) {
    res.status(500).json({ message: 'Failed to retrieve params', error: error.message });
  }
};

// UPDATE
exports.updateParam = async (req, res) => {
  try {
    const { nama } = req.body;
    const updatedParam = await Param.findByIdAndUpdate(
      req.params.id,
      { nama, updated_at: Date.now() },
      { new: true }
    );

    if (!updatedParam) return res.status(404).json({ message: 'Param not found' });

    res.status(200).json({ message: 'Param updated successfully', data: updatedParam });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update param', error: error.message });
  }
};

// DELETE
exports.deleteParam = async (req, res) => {
  try {
    const deletedParam = await Param.findOneAndDelete({
      nama: { $regex: `^${req.params.id}$`, $options: 'i' }
    });

    if (!deletedParam) {
      return res.status(404).json({ message: 'Param not found' });
    }

    res.status(200).json({ message: 'Param deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete param', error: error.message });
  }
};