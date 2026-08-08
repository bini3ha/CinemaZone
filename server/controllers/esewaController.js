import crypto from 'node:crypto';
import Booking from '../models/Booking.js';

export const verifyEsewaPayment = async (req, res) => {
    try {
        const { data } = req.query;

        // eSewa sends response as Base64 encoded JSON
        const decoded = JSON.parse(Buffer.from(data, 'base64').toString('utf-8'));

        const { total_amount, transaction_uuid, product_code, signed_field_names, signature } = decoded;

        // Re-compute signature to verify it's genuine
        const message = `total_amount=${total_amount},transaction_uuid=${transaction_uuid},product_code=${product_code}`;
        const expectedSignature = crypto.createHmac('sha256', process.env.ESEWA_SECRET_KEY)
            .update(message)
            .digest('base64');

        if (signature !== expectedSignature) {
            return res.redirect(`${process.env.CLIENT_URL}/my-bookings?payment=failed`);
        }

        // Mark booking as paid
        await Booking.findByIdAndUpdate(transaction_uuid, { isPaid: true });

        res.redirect(`${process.env.CLIENT_URL}/my-bookings?payment=success`);
    } catch (error) {
        console.log(error.message);
        res.redirect(`${process.env.CLIENT_URL}/my-bookings?payment=failed`);
    }
}
