 
const { Prescription, PrescriptionItem, sequelize } = require('../models');

// Obter todas as prescrições
exports.getPrescriptions = async (req, res) => {
  try {
    const prescriptions = await Prescription.findAll({
      include: [PrescriptionItem],
      order: [['date', 'DESC']]
    });
    res.json(prescriptions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Obter uma prescrição específica
exports.getPrescriptionById = async (req, res) => {
  try {
    const prescription = await Prescription.findByPk(req.params.id, {
      include: [PrescriptionItem]
    });
    
    if (!prescription) {
      return res.status(404).json({ message: 'Receita não encontrada' });
    }
    
    res.json(prescription);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Criar uma nova prescrição
exports.createPrescription = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    // Criar a prescrição
    const prescription = await Prescription.create({
      date: req.body.date || new Date(),
      doctorName: req.body.doctorName,
      doctorCRM: req.body.doctorCRM,
      patientName: req.body.patientName,
      patientCPF: req.body.patientCPF,
      status: req.body.status || 'Válida',
      expirationDate: req.body.expirationDate
    }, { transaction });
    
    // Adicionar itens da prescrição
    if (req.body.items && req.body.items.length > 0) {
      for (const item of req.body.items) {
        await PrescriptionItem.create({
          prescriptionId: prescription.id,
          medicationName: item.medicationName,
          dosage: item.dosage,
          duration: item.duration
        }, { transaction });
      }
    }
    
    await transaction.commit();
    
    // Buscar a prescrição com seus itens
    const newPrescription = await Prescription.findByPk(prescription.id, {
      include: [PrescriptionItem]
    });
    
    res.status(201).json(newPrescription);
  } catch (error) {
    await transaction.rollback();
    res.status(400).json({ message: error.message });
  }
};

// Atualizar uma prescrição
exports.updatePrescription = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    // Verificar se a prescrição existe
    const prescription = await Prescription.findByPk(req.params.id);
    
    if (!prescription) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Receita não encontrada' });
    }
    
    // Atualizar dados da prescrição
    await prescription.update({
      date: req.body.date || prescription.date,
      doctorName: req.body.doctorName || prescription.doctorName,
      doctorCRM: req.body.doctorCRM || prescription.doctorCRM,
      patientName: req.body.patientName || prescription.patientName,
      patientCPF: req.body.patientCPF || prescription.patientCPF,
      status: req.body.status || prescription.status,
      expirationDate: req.body.expirationDate || prescription.expirationDate
    }, { transaction });
    
    // Se houver novos itens, atualizar
    if (req.body.items) {
      // Excluir itens anteriores
      await PrescriptionItem.destroy({
        where: { prescriptionId: prescription.id },
        transaction
      });
      
      // Adicionar novos itens
      for (const item of req.body.items) {
        await PrescriptionItem.create({
          prescriptionId: prescription.id,
          medicationName: item.medicationName,
          dosage: item.dosage,
          duration: item.duration
        }, { transaction });
      }
    }
    
    await transaction.commit();
    
    // Buscar a prescrição atualizada com seus itens
    const updatedPrescription = await Prescription.findByPk(prescription.id, {
      include: [PrescriptionItem]
    });
    
    res.json(updatedPrescription);
  } catch (error) {
    await transaction.rollback();
    res.status(400).json({ message: error.message });
  }
};

// Excluir uma prescrição
exports.deletePrescription = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    // Verificar se a prescrição existe
    const prescription = await Prescription.findByPk(req.params.id);
    
    if (!prescription) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Receita não encontrada' });
    }
    
    // Excluir itens da prescrição
    await PrescriptionItem.destroy({
      where: { prescriptionId: prescription.id },
      transaction
    });
    
    // Excluir a prescrição
    await prescription.destroy({ transaction });
    
    await transaction.commit();
    
    res.json({ message: 'Receita removida com sucesso' });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ message: error.message });
  }
};

// Validar uma prescrição
exports.validatePrescription = async (req, res) => {
  try {
    const prescription = await Prescription.findByPk(req.params.id);
    
    if (!prescription) {
      return res.status(404).json({ message: 'Receita não encontrada' });
    }
    
    // Verificar validade da prescrição
    if (new Date(prescription.expirationDate) < new Date()) {
      prescription.status = 'Expirada';
    } else {
      prescription.status = 'Utilizada';
    }
    
    await prescription.save();
    res.json(prescription);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};