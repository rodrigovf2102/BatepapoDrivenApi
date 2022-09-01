import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

const server = express();
server.use(cors());
server.use(express.json());
dotenv.config();

const mongoClient  = new MongoClient(process.env.MONGO_URI);
let db;

mongoClient.connect().then(()=> {db = mongoClient.db('uol-backend');});

server.get('/participants', async (req,res)=>{
    try{
        const users = await db.collection('users').find().toArray();
        res.send(users);
    }catch{
        res.status(500).send("Server error");
    }
})





server.listen(5000);