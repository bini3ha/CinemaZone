import express from 'express';
import { createBooking, getEsewaPaymentData, getOccupiedSeats } from '../controllers/bookingController.js';

const bookingRouter = express.Router();


bookingRouter.post('/create', createBooking);
bookingRouter.get('/seats/:showId', getOccupiedSeats);
bookingRouter.post('/pay', getEsewaPaymentData);

export default bookingRouter;
