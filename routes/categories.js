const express = require('express');
const Category = require('../models/Category');
const auth = require('../middleware/auth');
const router = express.Router();

/**
 * @swagger
 * /api/categories:
 *   get:
 *     summary: Get all categories for the authenticated user
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of categories
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Category'
 *       500:
 *         description: Internal server error
 */
router.get('/', auth, async (req, res) => {
  try {
    const categories = await Category.find({ userId: req.userId });
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Failed to fetch categories' });
  }
});

/**
 * @swagger
 * /api/categories:
 *   post:
 *     summary: Create a new category
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - type
 *             properties:
 *               name:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [income, expense]
 *               color:
 *                 type: string
 *               icon:
 *                 type: string
 *     responses:
 *       201:
 *         description: Category created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Category'
 *       400:
 *         description: Bad request
 *       409:
 *         description: Category already exists
 *       500:
 *         description: Internal server error
 */
router.post('/', auth, async (req, res) => {
  try {
    const { name, type, color, icon } = req.body;
    
    if (!name || !type) {
      return res.status(400).json({ message: 'Name and type are required' });
    }
    
    if (!['income', 'expense'].includes(type)) {
      return res.status(400).json({ message: 'Type must be either income or expense' });
    }
    
    const existingCategory = await Category.findOne({ name, userId: req.userId });
    if (existingCategory) {
      return res.status(409).json({ message: 'Category with this name already exists' });
    }
    
    const category = new Category({ ...req.body, userId: req.userId });
    await category.save();
    res.status(201).json(category);
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ message: 'Failed to create category' });
  }
});

/**
 * @swagger
 * /api/categories/{id}:
 *   put:
 *     summary: Update a category
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Category ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [income, expense]
 *               color:
 *                 type: string
 *               icon:
 *                 type: string
 *     responses:
 *       200:
 *         description: Category updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Category'
 *       400:
 *         description: Bad request
 *       404:
 *         description: Category not found
 *       500:
 *         description: Internal server error
 */
router.put('/:id', auth, async (req, res) => {
  try {
    const category = await Category.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      req.body,
      { new: true }
    );
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    res.json(category);
  } catch (error) {
    console.error('Error updating category:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid category ID' });
    }
    res.status(500).json({ message: 'Failed to update category' });
  }
});

/**
 * @swagger
 * /api/categories/{id}:
 *   delete:
 *     summary: Delete a category
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Category ID
 *     responses:
 *       200:
 *         description: Category deleted successfully
 *       404:
 *         description: Category not found
 *       500:
 *         description: Internal server error
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    const category = await Category.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid category ID' });
    }
    res.status(500).json({ message: 'Failed to delete category' });
  }
});

module.exports = router;