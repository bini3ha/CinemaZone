import { Inngest, step } from "inngest";
import User from "../models/User.js";
import Booking from "../models/Booking.js";
import Show from "../models/Show.js";
import sendEmail from "../configs/nodeMailer.js";

// Create a client to send and receive events
export const inngest = new Inngest({ id: "movie-ticket-booking" });

//Inngest Function to save user data to a database
const syncUserCreation = inngest.createFunction(
    { id: 'sync-user-from-clerk', triggers: [{ event: "clerk/user.created" }] },
    async ({ event }) => {
        //Logic to save user to database
        const { id, first_name, last_name, email_addresses, image_url } = event.data
        const userData = {
            _id: id,
            email: email_addresses[0].email_address,
            name: first_name + ' ' + last_name,
            image: image_url
        }
        await User.create(userData)
    }
)

//Inngest Function to delete user data to a database
const syncUserDeletion = inngest.createFunction(
    { id: 'delete-user-from-clerk', triggers: [{ event: "clerk/user.deleted" }] },
    async ({ event }) => {
        const { id } = event.data
        await User.findByIdAndDelete(id)
    }
)

//Inngest Function to update user data to a database
const syncUserUpdation = inngest.createFunction(
    { id: 'update-user-from-clerk', triggers: [{ event: "clerk/user.updated" }] },
    async ({ event }) => {
        const { id, first_name, last_name, email_addresses, image_url } = event.data
        const userData = {
            _id: id,
            email: email_addresses[0].email_address,
            name: first_name + ' ' + last_name,
            image: image_url
        }
        await User.findByIdAndUpdate(id, userData)
    }
)

// Ingest to cancel booking and release seats of show after 10 minutes of booking created if payment not made
const releaseSeatsAndDeleteBooking = inngest.createFunction(
    { id: 'release-seats-delete-booking', triggers: [{ event: "app/checkpayment" }] },
    async ({ event, step }) => {
        const tenMinutesLater = new Date(Date.now() + 10 * 60 * 1000);
        await step.sleepUntil('wait-for-10-minutes', tenMinutesLater);

        await step.run('check-payment-status', async () => {
            const bookingId = event.data.bookingId;
            const booking = await Booking.findById(bookingId)

            //If payment is not made, release seats and delete booking
            if (!booking.isPaid) {
                const show = await Show.findById(booking.show);
                booking.bookedSeats.forEach((seat) => {
                    delete show.occupiedSeats[seat]
                });
                show.markModified('occupiedSeats')
                await show.save()
                await Booking.findByIdAndDelete(booking._id)
            }
        })
    }
)

// Inngest Function to send email when user books a show
const sendBookingConfirmationEmail = inngest.createFunction(
    { id: "send-booking-confirmation-email", triggers: [{ event: "app/show.booked" }] },
    async ({ event, step }) => {
        const { bookingId } = event.data;

        const booking = await Booking.findById(bookingId).populate({
            path: 'show',
            populate: { path: 'movie', model: "movie" }
        }).populate('user');

        await sendEmail({
            to: booking.user.email,
            subject: `Payment Confirmation: "${booking.show.movie.title}" booked!`,
            body: `
                <div>
                    <h2>Hello ${booking.user.name}</h2>
                    <p>Your booking for the movie <strong>${booking.show.movie.title}</strong> on ${new Date(booking.show.showDateTime).toLocaleString()} has been confirmed.</p>
                    <p>Seats booked: ${booking.bookedSeats.join(', ')}</p>
                    <p>Booking ID: ${booking._id}</p>
                    <p>Thank you for choosing our service!<br/> - CinemaZone</p>
                </div>
            `
        })
    }
)

// Inngest Function to send notifications when a new show is added
const sendNewShowNotifications = inngest.createFunction(
    { id: "send-new-show-notifications", triggers: [{ event: "app/show.added" }] },
    async ({ event}) => {
        const { movieTitle } = event.data;

        const users = await User.find({})

        for (const user of users) {
            const userEmail = user.email;
            const userName = user.name;

            const subject = `New Show Available: ${movieTitle}`;
            const body = `
                <div>
                    <h2>Hello ${userName}</h2>
                    <p>A new show for the movie <strong>${movieTitle}</strong> has been added.</p>
                    <p>Book now to secure your seats!<br/> - CinemaZone</p>
                </div>
            `;

            await sendEmail({
                to: userEmail,
                subject,
                body,
            })
        } 
        
        return {message: "Notifications sent!"}
    }
)

export const functions = [
    syncUserCreation,
    syncUserDeletion,
    syncUserUpdation,
    releaseSeatsAndDeleteBooking,
    sendBookingConfirmationEmail,
    sendNewShowNotifications
];