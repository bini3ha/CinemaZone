import express from 'express';
import { verifyEsewaPayment } from '../controllers/esewaController.js';

const esewaRouter = express.Router();

esewaRouter.get('/verify', verifyEsewaPayment);

export default esewaRouter;
