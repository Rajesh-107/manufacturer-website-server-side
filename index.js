const express = require('express');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.4tlkf.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });




async function run() {
    try {
        await client.connect();

        const bikePartCollection = client.db('bike-manufacturer').collection('bikeparts');
        const bookingCollection = client.db('bike-manufacturer').collection('booking');
        const userCollection = client.db('bike-manufacturer').collection('users');

        app.get('/bikepart', async(req, res) => {
            const query = {};
            const cursor = bikePartCollection.find(query);
            const bikeParts = await cursor.toArray();
            res.send(bikeParts);
        })

        app.put('/user/:email', async(req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options)
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '24h' })
            res.send({ result, token });
        })


        app.get('/booking', async(req, res) => {
            const myEmail = req.query.myEmail;
            const authorization = req.headers.authorization;
            console.log('auth header', authorization);
            const query = { myEmail: myEmail };
            const bookings = await bookingCollection.find(query).toArray();
            res.send(bookings);

        })

        app.post('/booking', async(req, res) => {
            const booking = req.body;
            const result = await bookingCollection.insertOne(booking);
            res.send(result);
        })

    } finally {

    }

}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Hello from Daves Bike parts');
});

app.listen(port, () => {
    console.log(`Bikeparts manufacturer  ${port}`);
})