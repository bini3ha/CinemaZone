import Booking from '../models/Booking.js';
import Show from '../models/Show.js'
import crypto from 'node:crypto'

// Function tp check availability of selected serats for a movie
const checkSeatsAvailability = async (showId, selectedSeats) => {
    try {
        const showData = await Show.findById(showId)
        if (!showData) return false;

        const occupiedSeats = showData.occupiedSeats;

        const isAnySeatTaken = selectedSeats.some(seat => occupiedSeats[seat]);

        return !isAnySeatTaken;
    } catch (error) {
        console.log(error.message)
        return false;
    }
}

export const createBooking = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { showId, selectedSeats } = req.body;
        const { origin } = req.headers;

        // Check if the seat is available for the selected show
        const isAvailable = await checkSeatsAvailability(showId, selectedSeats);

        if (!isAvailable) {
            return res.json({ success: false, message: "Selected Seats not available" })
        }

        // Get the show details
        const showData = await Show.findById(showId).populate('movie');

        // Create a new booking
        const booking = await Booking.create({
            user: userId,
            show: showId,
            amount: selectedSeats.length * showData.showPrice,
            bookedSeats: selectedSeats
        })

        selectedSeats.map((seat) => {
            showData.occupiedSeats[seat] = userId;
        })

        showData.markModified('occupiedSeats');

        await showData.save();

        // Generate eSewa payment data
        const amount = booking.amount;
        const taxAmount = 0;
        const totalAmount = amount;
        const transactionUuid = booking._id.toString();
        const productCode = process.env.ESEWA_PRODUCT_CODE;
        const successUrl = `${process.env.SERVER_URL}/api/esewa/verify`;
        const failureUrl = `${process.env.CLIENT_URL}/my-bookings`;

        const message = `total_amount=${totalAmount},transaction_uuid=${transactionUuid},product_code=${productCode}`;
        const signature = crypto.createHmac('sha256', process.env.ESEWA_SECRET_KEY)
            .update(message)
            .digest('base64');

        const esewaData = {
            amount,
            tax_amount: taxAmount,
            total_amount: totalAmount,
            transaction_uuid: transactionUuid,
            product_code: productCode,
            product_service_charge: 0,
            product_delivery_charge: 0,
            success_url: successUrl,
            failure_url: failureUrl,
            signed_field_names: 'total_amount,transaction_uuid,product_code',
            signature,
        };

        booking.paymentLink = JSON.stringify(esewaData);
        await booking.save();

        res.json({ success: true, message: "Booking Successful", esewaData })


    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message })
    }
}

export const getOccupiedSeats = async (req, res) => {
    try {
        const { showId } = req.params;
        const showData = await Show.findById(showId)

        const occupiedSeats = Object.keys(showData.occupiedSeats)

        res.json({ success: true, occupiedSeats })
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message })
    }
}

export const getEsewaPaymentData = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { bookingId } = req.body;

        const booking = await Booking.findById(bookingId);
        if (!booking || booking.user !== userId) {
            return res.json({ success: false, message: "Booking not found" });
        }

        const esewaData = JSON.parse(booking.paymentLink);
        res.json({ success: true, esewaData });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
}
