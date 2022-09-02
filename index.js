import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import joi from 'joi';
import dayjs from 'dayjs';

dayjs.locale('pt-br');
const server = express();
server.use(cors());
server.use(express.json());
dotenv.config();

const mongoClient  = new MongoClient(process.env.MONGO_URI);
let db;

mongoClient.connect().then(()=> {db = mongoClient.db('uol-backend');});

const userSchema = joi.object({
    name: joi.string().required()
})

server.get('/participants', async (req,res)=>{
    try{
        const users = await db.collection('users').find().toArray();
        res.send(users);
    }catch{
        res.status(500).send("Server error");
    }
})

server.post('/participants', async (req,res)=>{
    const { name } = req.body;
    const user = {};
    user.name = name;
    const validation = userSchema.validate(user);
    if(validation.error){
        res.status(422).send(validation.error.details[0].message);
        return;
    }
    try {
        const users = await db.collection('users').find().toArray();
        if(users.find(participant => participant.name === user.name)){
            res.status(409).send("User unavailable");
            return;
        }
    } catch (error) {
        res.status(500).send("User cannot be searched, server error");
        return;
    }
    user.lastStatus = Date.now();
    const message = {
        from: user.name,
        to: 'Todos',
        text: 'entra na sala...',
        type: user.lastStatus,
        time: dayjs(Date.now()).format('HH:mm:ss')
    }
    try{
        await db.collection('users').insertOne(user);
        await db.collection('messages').insertOne(message);
        res.sendStatus(201);
        return;
    } catch(error){
        res.status(500).send("User or entry message cannot be saved, server error");
        return;
    } 
})

server.get('/messages', async (req,res)=>{
    try{
        const messages = await db.collection('messages').find().toArray();
        res.send(messages);
    }catch{
        res.status(500).send("Server error");
    }
})

server.listen(5000);