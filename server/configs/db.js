import mongoose from "mongoose";

const connectDB = async () =>{
    try {
        mongoose.connection.on('connected', ()=> console.log('Datbase connected'));
        await mongoose.connect(`${process.env.MONGODB_URI}/cinemazone`)
    } catch (error) {
        console.log(error.message);
        
    }
}

export default connectDB;