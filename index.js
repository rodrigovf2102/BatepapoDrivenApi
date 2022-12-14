import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId, ReturnDocument } from 'mongodb';
import dotenv from 'dotenv';
import joi from 'joi';
import dayjs from 'dayjs';
import { strict as assert } from "assert";
import { stripHtml } from "string-strip-html";

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
const updateMessageSchema = joi.object({
    to: joi.string().empty().required(),
    text: joi.string().empty().required(),
    type: joi.string().required().valid('message', 'private_message')
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
    let { name } = req.body;
    const user = {};
    name = stripHtml(name,{skipHtmlDecoding:true}).result.trim();
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
        for (let i = messages.length - 1; i >= 0; i--) {
            const condition = (messages[i].type === 'message'
                || messages[i].from === user
                || messages[i].to === user
                || messages[i].type === 'status')
            if (condition) {
                limitMessages.push(messages[i]);
                counter++;
            }
            if (counter === Number(limit)) {
                counter = 0;
                break;
            }
        }
        res.send(limitMessages);
    } catch {
        res.status(500).send("Server error");
    }
})

server.post('/messages', async (req, res) => {
    let { to, text, type } = req.body;
    let { user } = req.headers;
    to= stripHtml(to,{skipHtmlDecoding:true}).result.trim();
    text= stripHtml(text,{skipHtmlDecoding:true}).result.trim();
    type= stripHtml(type,{skipHtmlDecoding:true}).result.trim();
    user= stripHtml(user,{skipHtmlDecoding:true}).result.trim();
    const message = {
        to: to,
        text: text,
        type: type,
        from: user,
        time: dayjs().format('HH:mm:ss')
    };
    const validation = messageSchema.validate(message, { abortEarly: false });
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

server.post('/status', async (req, res) => {
    const { user } = req.headers;
    try {
        const participant = await db.collection('users').findOne({ name: user });
        if (!participant) {
            res.status(404).send('Error: user not found');
            return;
        }
        await db.collection('users')
        .updateOne({ _id: participant._id }, { $set: { lastStatus: Date.now() } })
        res.sendStatus(200);
        return;
    } catch (error) {
        res.status(500).send('Error: unable to update user on database');
        return;
    }
})

server.delete('/messages/:ID_DA_MENSAGEM', async(req,res)=>{
    const { user } = req.headers;
    const { ID_DA_MENSAGEM } = req.params;
    try {
        const message = await db.collection('messages')
        .findOne({_id: ObjectId(ID_DA_MENSAGEM)});
        if(!message){
            res.status(404).send('Error: message not found');
            return;
        }
        
        if(message.from !== user){
            res.status(401).send('Error: user is not the message creator');
            return;
        }
        await db.collection('messages').deleteOne({_id: ObjectId(ID_DA_MENSAGEM)});
        res.status(201).send('Message deleted');
    } catch (error) {
        res.status(500).send('Error: unable to search or delete message from database');
    }

})

server.put('/messages/:ID_DA_MENSAGEM',async(req,res)=>{
    let {to,text,type} = req.body;
    const {user} = req.headers;
    const {ID_DA_MENSAGEM} = req.params;
    
    to= stripHtml(to,{skipHtmlDecoding:true}).result.trim();
    text= stripHtml(text,{skipHtmlDecoding:true}).result.trim();
    type= stripHtml(type,{skipHtmlDecoding:true}).result.trim();
    const message = {
        to: to,
        text: text,
        type: type,
    };

    const validation = updateMessageSchema.validate(message, { abortEarly: false });
    if (validation.error) {
        const errors = validation.error.details.map(detail => detail.message);
        res.status(422).send(errors);
        return;
    }
    try {
        const from = await db.collection('users').findOne({name:user});
        if(!from){
            res.status(422).send('Error: user not found');
            return;
        }
        if(to!=='Todos'){
            const para = await db.collection('users').findOne({name:to});
            if(!para){
                res.status(422).send('Error: receiver not found');
                return;
            }
        }
        message.from=user;
        const dbMessage = await db.collection('messages')
        .findOne({_id:ObjectId(ID_DA_MENSAGEM)});
        if(!dbMessage){
            res.status(404).send('Error: message not found');
            return;
        }
        if(dbMessage.from !== user){
            res.status(401).send('Error: user is not the message creator');
            return;
        }
        await db.collection('messages').updateOne({_id:ObjectId(ID_DA_MENSAGEM)},
        {$set:{to:to,text:text,type:type}});
        res.sendStatus(200);
        return;
    } catch (error) {
        res.status(500).send('Error: unable to update message on database');
        return;
    }
})


setInterval(async () => {
    try {
        let users = await db.collection('users').find().toArray();
        if(users.length === 0){
            return;
        }
        users = users.filter(user =>  Math.abs(user.lastStatus - Date.now()) > 10000 );
        if(users.length === 0){
            return;
        }       
        users.map(async (user) => {
            const lastMessage = {
                from: user.name,
                to: 'Todos',
                text: 'sai da sala...',
                type: 'status',
                time: dayjs().format('HH:mm:ss')
            }
            await db.collection('messages').insertOne(lastMessage);
        })
        users.map(async (user) => await db.collection('users').deleteOne(user) );
    } catch (error) {
        console.log(error);
    }
}, 15000)


server.listen(5000);