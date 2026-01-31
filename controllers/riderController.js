const Rider = require('../models/Rider');

exports.getAllRiders = async (req, res) => {
    try {
        const riders = await Rider.find().sort({ joinedDate: -1 });
        res.json(riders);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching riders', error: error.message });
    }
};

exports.createRider = async (req, res) => {
    try {
        const { name, phone, location, vehicleType, photoUrl, status } = req.body;

        const existing = await Rider.findOne({ phone });
        if (existing) {
            return res.status(400).json({ message: 'Rider with this phone already exists' });
        }

        const newRider = new Rider({
            name,
            phone,
            location,
            vehicleType,
            photoUrl,
            status: status || 'Active'
        });

        await newRider.save();
        res.status(201).json({ message: 'Rider added successfully', rider: newRider });
    } catch (error) {
        res.status(500).json({ message: 'Error creating rider', error: error.message });
    }
};

exports.updateRider = async (req, res) => {
    try {
        const { name, phone, location, vehicleType, photoUrl, status, isAvailable } = req.body;
        const updatedRider = await Rider.findByIdAndUpdate(
            req.params.id,
            { name, phone, location, vehicleType, photoUrl, status, isAvailable },
            { new: true }
        );
        res.json({ message: 'Rider updated', rider: updatedRider });
    } catch (error) {
        res.status(500).json({ message: 'Error updating rider', error: error.message });
    }
};

exports.deleteRider = async (req, res) => {
    try {
        await Rider.findByIdAndDelete(req.params.id);
        res.json({ message: 'Rider deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting rider', error: error.message });
    }
};
