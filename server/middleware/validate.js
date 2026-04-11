const Joi = require('joi');

const validate = (schema, property = 'body') => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req[property], { abortEarly: false, stripUnknown: true });
        
        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message.replace(/"/g, '')
            }));
            
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Validation failed',
                    details: errors
                }
            });
        }
        
        req[property] = value;
        next();
    };
};

const schemas = {
    login: Joi.object({
        username: Joi.string().required().min(2).max(50),
        password: Joi.string().required().min(4).max(100),
        tenant_code: Joi.string().optional()
    }),
    
    supplier: Joi.object({
        code: Joi.string().required().max(50),
        name: Joi.string().required().min(2).max(200),
        name_bn: Joi.string().max(200).allow('', null),
        contact_person: Joi.string().max(100).allow('', null),
        phone: Joi.string().max(20).allow('', null),
        mobile: Joi.string().max(20).allow('', null),
        email: Joi.string().email().max(100).allow('', null),
        address: Joi.string().max(500).allow('', null),
        city: Joi.string().max(100).allow('', null),
        state: Joi.string().max(100).allow('', null),
        gstin: Joi.string().max(20).allow('', null),
        pan: Joi.string().max(20).allow('', null),
        credit_limit: Joi.number().min(0).default(0),
        payment_terms: Joi.string().max(50).default('NET30'),
        is_active: Joi.boolean().default(true)
    }),
    
    customer: Joi.object({
        code: Joi.string().required().max(50),
        name: Joi.string().required().min(2).max(200),
        name_bn: Joi.string().max(200).allow('', null),
        type: Joi.string().valid('dealer', 'retailer', 'direct', 'government').default('dealer'),
        contact_person: Joi.string().max(100).allow('', null),
        phone: Joi.string().max(20).allow('', null),
        mobile: Joi.string().max(20).allow('', null),
        email: Joi.string().email().max(100).allow('', null),
        address: Joi.string().max(500).allow('', null),
        city: Joi.string().max(100).allow('', null),
        state: Joi.string().max(100).allow('', null),
        gstin: Joi.string().max(20).allow('', null),
        credit_limit: Joi.number().min(0).default(0),
        price_list: Joi.string().max(50).default('standard'),
        is_active: Joi.boolean().default(true)
    }),
    
    factory: Joi.object({
        name: Joi.string().required().min(2).max(200),
        code: Joi.string().required().max(50),
        address: Joi.string().max(500).allow('', null),
        phone: Joi.string().max(20).allow('', null),
        email: Joi.string().email().max(100).allow('', null),
        is_active: Joi.boolean().default(true)
    }),
    
    godown: Joi.object({
        name: Joi.string().required().min(2).max(200),
        code: Joi.string().required().max(50),
        factory_id: Joi.string().uuid().required(),
        location: Joi.string().max(200).allow('', null),
        capacity: Joi.number().min(0).allow(null),
        is_active: Joi.boolean().default(true)
    }),
    
    rawMaterial: Joi.object({
        code: Joi.string().required().max(50),
        name: Joi.string().required().min(2).max(200),
        name_bn: Joi.string().max(200).allow('', null),
        category: Joi.string().required().valid('grains', 'oilcakes', 'minerals', 'vitamins', 'additives', 'premix', 'fiber', 'energy', 'protein', 'other'),
        unit_id: Joi.string().uuid().required(),
        hsn_code: Joi.string().max(20).allow('', null),
        opening_qty: Joi.number().min(0).default(0),
        opening_rate: Joi.number().min(0).default(0),
        min_stock_level: Joi.number().min(0).default(0),
        max_stock_level: Joi.number().min(0).allow(null),
        is_active: Joi.boolean().default(true)
    }),
    
    product: Joi.object({
        code: Joi.string().required().max(50),
        name: Joi.string().required().min(2).max(200),
        name_bn: Joi.string().max(200).allow('', null),
        product_type: Joi.string().required().valid('cattle', 'poultry', 'fish', 'shrimp', 'other'),
        category: Joi.string().required().valid('feed', 'premix', 'supplement', 'medicine', 'other'),
        unit_id: Joi.string().uuid().required(),
        pack_size: Joi.number().min(0).default(0),
        mrp: Joi.number().min(0).default(0),
        sale_rate: Joi.number().min(0).default(0),
        hsn_code: Joi.string().max(20).allow('', null),
        is_active: Joi.boolean().default(true)
    }),
    
    purchaseOrder: Joi.object({
        po_number: Joi.string().max(50),
        po_date: Joi.date().required(),
        supplier_id: Joi.string().uuid().required(),
        expected_date: Joi.date().allow(null),
        items: Joi.array().items(Joi.object({
            raw_material_id: Joi.string().uuid().required(),
            qty: Joi.number().min(0.01).required(),
            rate: Joi.number().min(0).required(),
            tax_rate: Joi.number().min(0).max(100).default(0),
            amount: Joi.number().min(0).required()
        })).min(1).required(),
        notes: Joi.string().max(1000).allow('', null),
        terms: Joi.string().max(1000).allow('', null)
    }),
    
    goodsInward: Joi.object({
        po_id: Joi.string().uuid().required(),
        grn_number: Joi.string().max(50),
        inward_date: Joi.date().required(),
        godown_id: Joi.string().uuid().required(),
        items: Joi.array().items(Joi.object({
            po_item_id: Joi.string().uuid().required(),
            raw_material_id: Joi.string().uuid().required(),
            qty: Joi.number().min(0.01).required(),
            rate: Joi.number().min(0).required(),
            amount: Joi.number().min(0).required(),
            batch_number: Joi.string().max(50).allow('', null),
            expiry_date: Joi.date().allow(null),
            mfg_date: Joi.date().allow(null),
            remarks: Joi.string().max(500).allow('', null)
        })).min(1).required(),
        notes: Joi.string().max(1000).allow('', null)
    }),
    
    formula: Joi.object({
        code: Joi.string().required().max(50),
        name: Joi.string().required().min(2).max(200),
        product_id: Joi.string().uuid().required(),
        version: Joi.number().integer().min(1).default(1),
        batch_size: Joi.number().min(1).required(),
        total_cost: Joi.number().min(0).default(0),
        cost_per_kg: Joi.number().min(0).default(0),
        status: Joi.string().valid('draft', 'approved', 'active', 'archived').default('draft'),
        ingredients: Joi.array().items(Joi.object({
            raw_material_id: Joi.string().uuid().required(),
            percentage: Joi.number().min(0).max(100).required(),
            min_percentage: Joi.number().min(0).max(100).allow(null),
            max_percentage: Joi.number().min(0).max(100).allow(null),
            cost_per_kg: Joi.number().min(0).default(0)
        })).min(1).required(),
        nutrients: Joi.object({
            protein: Joi.number().min(0).max(100).allow(null),
            fat: Joi.number().min(0).max(100).allow(null),
            fiber: Joi.number().min(0).max(100).allow(null),
            ash: Joi.number().min(0).max(100).allow(null),
            moisture: Joi.number().min(0).max(100).allow(null),
            energy: Joi.number().min(0).allow(null),
            calcium: Joi.number().min(0).max(100).allow(null),
            phosphorus: Joi.number().min(0).max(100).allow(null)
        }).allow(null)
    }),
    
    productionBatch: Joi.object({
        batch_number: Joi.string().required().max(50),
        formula_id: Joi.string().uuid().required(),
        machine_id: Joi.string().uuid().required(),
        batch_size: Joi.number().min(1).required(),
        started_at: Joi.date().required(),
        expected_completion: Joi.date().allow(null),
        notes: Joi.string().max(500).allow('', null)
    }),
    
    salesOrder: Joi.object({
        order_number: Joi.string().max(50),
        order_date: Joi.date().required(),
        customer_id: Joi.string().uuid().required(),
        expected_date: Joi.date().allow(null),
        items: Joi.array().items(Joi.object({
            product_id: Joi.string().uuid().required(),
            qty: Joi.number().min(0.01).required(),
            rate: Joi.number().min(0).required(),
            discount_percent: Joi.number().min(0).max(100).default(0),
            tax_rate: Joi.number().min(0).max(100).default(0),
            amount: Joi.number().min(0).required()
        })).min(1).required(),
        notes: Joi.string().max(1000).allow('', null)
    }),
    
    salesInvoice: Joi.object({
        invoice_number: Joi.string().max(50),
        invoice_date: Joi.date().required(),
        customer_id: Joi.string().uuid().required(),
        sales_order_id: Joi.string().uuid().allow(null),
        items: Joi.array().items(Joi.object({
            product_id: Joi.string().uuid().required(),
            qty: Joi.number().min(0.01).required(),
            rate: Joi.number().min(0).required(),
            discount_percent: Joi.number().min(0).max(100).default(0),
            discount_amount: Joi.number().min(0).default(0),
            tax_rate: Joi.number().min(0).max(100).default(0),
            tax_amount: Joi.number().min(0).default(0),
            amount: Joi.number().min(0).required()
        })).min(1).required(),
        subtotal: Joi.number().min(0).required(),
        discount_percent: Joi.number().min(0).max(100).default(0),
        discount_amount: Joi.number().min(0).default(0),
        tax_amount: Joi.number().min(0).default(0),
        total_amount: Joi.number().min(0).required(),
        notes: Joi.string().max(1000).allow('', null)
    }),
    
    account: Joi.object({
        code: Joi.string().required().max(50),
        name: Joi.string().required().min(2).max(200),
        group_id: Joi.string().uuid().allow(null),
        account_type: Joi.string().valid('asset', 'liability', 'income', 'expense').required(),
        is_active: Joi.boolean().default(true)
    }),
    
    transaction: Joi.object({
        date: Joi.date().required(),
        account_id: Joi.string().uuid().required(),
        transaction_type: Joi.string().valid('debit', 'credit').required(),
        amount: Joi.number().min(0.01).required(),
        narration: Joi.string().max(500).allow('', null),
        reference_type: Joi.string().valid('invoice', 'receipt', 'payment', 'journal', 'contra').allow('', null),
        reference_id: Joi.string().uuid().allow(null),
        is_posted: Joi.boolean().default(true)
    }),
    
    payment: Joi.object({
        payment_date: Joi.date().required(),
        party_type: Joi.string().valid('supplier', 'customer').required(),
        party_id: Joi.string().uuid().required(),
        amount: Joi.number().min(0.01).required(),
        payment_mode: Joi.string().valid('cash', 'bank', 'upi', 'cheque', 'neft', 'rtgs').required(),
        reference_number: Joi.string().max(50).allow('', null),
        notes: Joi.string().max(500).allow('', null)
    }),
    
    vehicle: Joi.object({
        vehicle_number: Joi.string().required().max(20),
        vehicle_type: Joi.string().valid('truck', 'tempo', 'van', 'two_wheeler', 'other').default('truck'),
        capacity: Joi.number().min(0).default(0),
        driver_id: Joi.string().uuid().allow(null),
        is_active: Joi.boolean().default(true)
    }),
    
    driver: Joi.object({
        name: Joi.string().required().min(2).max(100),
        phone: Joi.string().max(20).allow('', null),
        license_number: Joi.string().max(50).allow('', null),
        address: Joi.string().max(500).allow('', null),
        is_active: Joi.boolean().default(true)
    }),
    
    deliveryOrder: Joi.object({
        delivery_number: Joi.string().max(50),
        delivery_date: Joi.date().required(),
        invoice_id: Joi.string().uuid().required(),
        vehicle_id: Joi.string().uuid().required(),
        driver_id: Joi.string().uuid().required(),
        expected_delivery: Joi.date().allow(null),
        notes: Joi.string().max(500).allow('', null)
    }),
    
    user: Joi.object({
        username: Joi.string().required().min(3).max(50),
        password: Joi.string().min(6).max(100).when('isNew', { is: true, then: Joi.required() }),
        full_name: Joi.string().required().min(2).max(100),
        email: Joi.string().email().max(100).allow('', null),
        phone: Joi.string().max(20).allow('', null),
        role_id: Joi.string().uuid().required(),
        factory_id: Joi.string().uuid().allow(null),
        is_active: Joi.boolean().default(true)
    }),
    
    role: Joi.object({
        name: Joi.string().required().min(2).max(100),
        description: Joi.string().max(500).allow('', null),
        permissions: Joi.object().pattern(Joi.string(), Joi.array().items(Joi.string().valid('view', 'add', 'edit', 'delete', 'approve', 'export', 'import')))
    }),
    
    transfer: Joi.object({
        transfer_number: Joi.string().max(50),
        transfer_date: Joi.date().required(),
        from_godown_id: Joi.string().uuid().required(),
        to_godown_id: Joi.string().uuid().required(),
        items: Joi.array().items(Joi.object({
            item_type: Joi.string().valid('raw_material', 'product').required(),
            item_id: Joi.string().uuid().required(),
            qty: Joi.number().min(0.01).required(),
            rate: Joi.number().min(0).required(),
            amount: Joi.number().min(0).required()
        })).min(1).required(),
        notes: Joi.string().max(1000).allow('', null)
    }),
    
    adjustment: Joi.object({
        adjustment_number: Joi.string().max(50),
        adjustment_date: Joi.date().required(),
        godown_id: Joi.string().uuid().required(),
        reason: Joi.string().valid('damaged', 'expired', 'theft', 'count', 'other').required(),
        items: Joi.array().items(Joi.object({
            item_type: Joi.string().valid('raw_material', 'product').required(),
            item_id: Joi.string().uuid().required(),
            current_qty: Joi.number().min(0).required(),
            adjusted_qty: Joi.number().min(0).required(),
            difference: Joi.number().required(),
            rate: Joi.number().min(0).required(),
            amount: Joi.number().min(0).required(),
            reason: Joi.string().max(200).allow('', null)
        })).min(1).required(),
        notes: Joi.string().max(1000).allow('', null)
    })
};

module.exports = { validate, schemas };
