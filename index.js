import express from 'express';
import cors from 'cors';
import { MongoClient, ReturnDocument } from 'mongodb';
import dotenv from 'dotenv';
import joi from 'joi';
import dayjs from 'dayjs';

dayjs.locale('pt-br');
const server = express();
server.use(cors());
server.use(express.json());
dotenv.config();

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;

mongoClient.connect().then(() => { db = mongoClient.db('uol-backend'); });

const userSchema = joi.object({
    name: joi.string().empty().required()
})
const messageSchema = joi.object({
    to: joi.string().empty().required(),
    text: joi.string().empty().required(),
    type: joi.string().required().valid('message', 'private_message'),
    from: joi.string().empty().required(),
    time: joi.string().required()
})

server.get('/participants', async (req, res) => {
    try {
        const users = await db.collection('users').find().toArray();
        res.send(users);
    } catch {
        res.status(500).send("Server error");
    }
})

server.post('/participants', async (req, res) => {
    const { name } = req.body;
    const user = {};
    user.name = name;
    const validation = userSchema.validate(user);
    if (validation.error) {
        res.status(422).send(validation.error.details[0].message);
        return;
    }
    try {
        const users = await db.collection('users').find().toArray();
        if (users.find(participant => participant.name === user.name)) {
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
        type: 'status',
        time: dayjs(Date.now()).format('HH:mm:ss')
    }
    try {
        await db.collection('users').insertOne(user);
        await db.collection('messages').insertOne(message);
        res.sendStatus(201);
        return;
    } catch (error) {
        res.status(500).send("User or entry message cannot be saved, server error");
        return;
    }
})

server.get('/messages', async (req, res) => {
    const { limit } = req.query;
    const { user } = req.headers;
    try {
        const messages = await db.collection('messages').find().toArray();
        const limitMessages = [];
        let counter = 0;
        for(let i=messages.length-1;i>=0;i--){
            const condition = (messages[i].type === 'message' 
                            || messages[i].from === user 
                            || messages[i].to === user)
            if(condition){
                limitMessages.push(messages[i]);
                counter++;
            }
            if(counter===Number(limit)){
                counter=0;
                break;
            }
        }
        res.send(limitMessages);
    } catch {
        res.status(500).send("Server error");
    }
})

server.post('/messages', async (req, res) => {
    const { to, text, type } = req.body;
    const { user } = req.headers;
    const message = {
        to: to,
        text: text,
        type: type,
        from: user,
        time: dayjs().format('HH:mm:ss')
    };
    const validation = messageSchema.validate(message,{abortEarly:false});
    if (validation.error) {
        const errors = validation.error.details.map(detail => detail.message);
        res.status(422).send(errors);
        return;
    }
    try {
        const validation = await db.collection('users').findOne({ name: user });
        if (!validation) {
            res.status(409).send("Error: user not found");
            return;
        }
    } catch (error) {
        res.status(500).send("Error: Unable to search for user on database");
        return;
    }
    try {
        if (to !== 'Todos') {
            const validation = await db.collection('users').findOne({ name: to });
            if (!validation) {
                res.status(409).send("Error: receiver not found");
                return;
            }
        }
    } catch (error) {
        res.status(500).send("Error: Unable to search for receiver on database")
    }
    try {
        await db.collection('messages').insertOne(message);
        res.sendStatus(201);
        return;
    } catch (error) {
        res.status(500).send('Error: Unable to insert message on database');
        return;
    }
})

server.post('/status', async (req,res)=>{
    const { user } = req.headers;
    try {
        const participant = await db.collection('users').findOne({name: user});
        if(!participant){
            res.status(404).send('Error: user not found');
            return;
        }
        await db.collection('users').updateOne({_id: participant._id},{$set:{lastStatus:Date.now()}})
        res.sendStatus(200);
        return;
    } catch (error) {
        res.status(500).send('Error: unable to update user on database');
        return;
    }
})

server.listen(5000);