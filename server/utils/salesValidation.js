const { queryOne } = require('../config/database');

async function validateOrder(req, res, next) {
    const { customer_id, items } = req.body;
    
    if (!customer_id || !items || items.length === 0) {
        return res.status(400).json({ 
            success: false, 
            error: { code: 'VALIDATION_ERROR', message: 'Customer and items required' } 
        });
    }

    const customer = queryOne('SELECT * FROM customers WHERE id = ?', [customer_id]);
    if (!customer) {
        return res.status(404).json({ 
            success: false, 
            error: { code: 'NOT_FOUND', message: 'Customer not found' } 
        });
    }

    const totalAmount = items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.rate || 0)), 0);
    const newOutstanding = (customer.outstanding || 0) + totalAmount;
    
    if (customer.credit_limit && newOutstanding > customer.credit_limit) {
        const available = customer.credit_limit - customer.outstanding;
        
        if (available < 0) {
            return res.status(400).json({
                success: false,
                error: { 
                    code: 'CREDIT_LIMIT_EXCEEDED', 
                    message: `Credit limit exceeded. Available: ${available.toFixed(2)}`,
                    currentOutstanding: customer.outstanding,
                    creditLimit: customer.credit_limit,
                    thisOrder: totalAmount
                }
            });
        }
        
        req.creditWarning = {
            message: 'Order exceeds credit limit but can proceed with approval',
            available,
            thisOrder: totalAmount,
            newOutstanding
        };
    }

    const stockValidation = await validateStockAvailablity(req.tenantId, items);
    if (!stockValidation.valid) {
        return res.status(400).json({
            success: false,
            error: { 
                code: 'INSUFFICIENT_STOCK', 
                message: `Insufficient stock for ${stockValidation.item}`,
                available: stockValidation.available,
                required: stockValidation.required
            }
        });
    }

    next();
}

async function validateStockAvailablity(tenantId, items) {
    for (const item of items) {
        if (!item.product_id || !item.godown_id) continue;
        
        const stock = queryOne(`
            SELECT COALESCE(SUM(quantity), 0) as balance_qty
            FROM stock_ledger
            WHERE tenant_id = ? AND item_type = 'product' AND item_id = ? AND godown_id = ?
        `, [tenantId, item.product_id, item.godown_id]);

        if (stock && stock.balance_qty < item.quantity) {
            return { valid: false, item: item.product_id, available: stock.balance_qty, required: item.quantity };
        }
    }
    return { valid: true };
}

async function validatePurchaseOrder(req, res, next) {
    const { supplier_id, items, over_delivery_percent = 10 } = req.body;
    
    if (!supplier_id || !items || items.length === 0) {
        return res.status(400).json({ 
            success: false, 
            error: { code: 'VALIDATION_ERROR', message: 'Supplier and items required' } 
        });
    }

    const supplier = queryOne('SELECT * FROM suppliers WHERE id = ?', [supplier_id]);
    if (!supplier) {
        return res.status(404).json({ 
            success: false, 
            error: { code: 'NOT_FOUND', message: 'Supplier not found' } 
        });
    }

    req.supplier = supplier;
    next();
}

async function checkOverDelivery(poItem, receivedQty) {
    if (!poItem || !receivedQty) return { allowed: true };
    
    const overPercent = ((receivedQty - poItem.quantity) / poItem.quantity) * 100;
    const maxAllowed = 10;
    
    return {
        allowed: overPercent <= maxAllowed,
        overPercent,
        maxAllowed,
        message: overPercent > maxAllowed 
            ? `Over-delivery exceeds ${maxAllowed}% limit (${overPercent.toFixed(1)}%)`
            : null
    };
}

async function lockStockForTransaction(tenantId, items, referenceId, type = 'sale') {
    const lockId = `lock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
        for (const item of items) {
            if (!item.product_id || !item.godown_id) continue;
            
            const exists = queryOne(`
                SELECT id FROM stock_locks 
                WHERE tenant_id = ? AND item_id = ? AND godown_id = ? 
                AND reference_id = ? AND lock_type = ? AND expires_at > datetime('now')
            `, [tenantId, item.product_id, item.godown_id, referenceId, type]);

            if (exists) {
                return { valid: false, message: 'Item already locked for another transaction' };
            }
        }
        
        return { valid: true, lockId };
    } catch (error) {
        return { valid: true, lockId };
    }
}

module.exports = {
    validateOrder,
    validatePurchaseOrder,
    checkOverDelivery,
    validateStockAvailablity,
    lockStockForTransaction
};