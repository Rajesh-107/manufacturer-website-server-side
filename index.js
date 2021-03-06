const express = require('express');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_KEY);

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.4tlkf.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'UnAuthorized access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function(err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' })
        }
        req.decoded = decoded;
        next();
    })
}


async function run() {
    try {
        await client.connect();

        const bikePartCollection = client.db('bike-manufacturer').collection('bikeparts');
        const bookingCollection = client.db('bike-manufacturer').collection('booking');
        const userCollection = client.db('bike-manufacturer').collection('users');
        const productCollection = client.db('bike-manufacturer').collection('product');
        const paymentCollection = client.db('bike-manufacturer').collection('payments');

        const verifyAdmin = async(req, res, next) => {
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({ email: requester })
            if (requesterAccount.role === 'admin') {
                next()
            } else {
                res.status(403).send({ message: 'forbidden' });
            }
        }

        app.post('/create-payment-intent', async(req, res) => {
            const items = req.body;
            const price = items.price;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({ clientSecret: paymentIntent.client_secret })
        })

        app.get('/bikepart', async(req, res) => {
            const query = {};
            const cursor = bikePartCollection.find(query);
            const bikeParts = await cursor.toArray();
            res.send(bikeParts);
        })

        app.get('/user', async(req, res) => {
            const users = await userCollection.find().toArray();
            res.send(users);
        })

        app.get('/admin/:email', verifyJWT, async(req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin });
        })


        app.put('/user/admin/:email', verifyJWT, verifyAdmin, async(req, res) => {
            const email = req.params.email;

            const filter = { email: email };
            const updateDoc = {
                $set: { role: 'admin' },
            };
            const result = await userCollection.updateOne(filter, updateDoc)
            res.send(result);

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


        app.get('/booking', verifyJWT, async(req, res) => {
            const myEmail = req.query.myEmail;
            const decodedEmail = req.decoded.email;
            if (myEmail === decodedEmail) {
                const query = { myEmail: myEmail };
                const bookings = await bookingCollection.find(query).toArray();
                res.send(bookings);
            } else {
                return res.status(403).send({ message: 'forbidden access' })
            }

        })

        app.get('/booking/:id', verifyJWT, async(req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const booking = await bookingCollection.findOne(query);
            res.send(booking);
        })

        app.post('/bikepart', verifyJWT, async(req, res) => {
            const newParts = req.body;
            const result = await bikePartCollection.insertOne(newParts);
            res.send(result);
        })

        app.patch('/booking/:id', async(req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = { _id: ObjectId(id) };
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId
                }
            }
            const result = await paymentCollection.insertOne(payment);
            const updateBooking = await bookingCollection.updateOne(filter, updatedDoc);
            res.send(updatedDoc)

        })

        app.post('/product', verifyJWT, verifyAdmin, async(req, res) => {
            const product = req.body;
            const result = await productCollection.insertOne(product);
            res.send(result);
        })
        app.delete('/product/:email', verifyJWT, async(req, res) => {
            const productName = req.params.productName; //change here
            const filter = { productName: productName }
            const result = await productCollection.deleteOne(filter);
            res.send(result);
        })

        app.get('/product', verifyJWT, async(req, res) => {
            const products = await productCollection.find().toArray();
            res.send(products);
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