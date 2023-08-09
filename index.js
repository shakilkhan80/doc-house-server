const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000



// middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unable to connect' });
    }
    // bearer token
    const token = authorization.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'unauthorized' })
        }
        req.decoded = decoded;
        next();
    })

}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.pmjxifl.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        const usersCollection = client.db("docDB").collection("users");
        const reviewsCollection = client.db("docDB").collection("reviews");
        const doctorCollection = client.db("docDB").collection("doctor");
        const serviceCollection = client.db("docDB").collection("service");
        const bookingsCollection = client.db("docDB").collection("bookings");
        const paymentsCollection = client.db("docDB").collection("payments");
        const contactsCollection = client.db("docDB").collection("contacts");



        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ token })
        })
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query)
            if (user?.role !== 'admin') {
                res.status(403).send({ error: true, message: "forbidden" })
            }
            next();
        }
        // contact us
        app.post('/contact-message', async (req, res) => {
            const message = req.body;
            const result = await contactsCollection.insertOne(message);
            res.send(result)
        })

        // users collection
        app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result)
        })

        app.post('/users', async (req, res) => {
            const user = req.body;

            const query = { email: user.email }
            const existingUser = await usersCollection.findOne(query)
            if (existingUser) {
                return res.send({ message: 'user already exist' })
            }
            const result = await usersCollection.insertOne(user)
            res.send(result)
        })

        app.delete('/users/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await usersCollection.deleteOne(query)
            res.send(result)
        })

        app.get('/users/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;

            if (req.decoded.email !== email) {
                res.send({ admin: false })
            }

            const query = { email: email }
            const user = await usersCollection.findOne(query);
            const result = { admin: user?.role === "admin" }
            res.send(result)
        })

        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    role: 'admin'
                },
            }
            const result = await usersCollection.updateOne(filter, updateDoc)
            res.send(result)
        })

        // review section
        app.get('/reviews', async (req, res) => {
            const result = await reviewsCollection.find().toArray();
            res.send(result)
        })
        // app.get('/reviews/:id', async (req, res) => {
        //     const id = req.params.id;
        //     const query = { _id: new ObjectId(id) }
        //     const result = await reviewsCollection.findOne(query)
        //     res.send(result)
        //     console.log(result);
        // })

        // doctor section
        app.get('/doctor', async (req, res) => {
            const result = await doctorCollection.find().toArray();
            res.send(result)
        })

        app.post('/doctor', verifyJWT, verifyAdmin, async (req, res) => {
            const newDoc = req.body;
            const result = await doctorCollection.insertOne(newDoc)
            res.send(result)
        })

        app.delete('/doctor/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await doctorCollection.deleteOne(query)
            res.send(result)
        })

        app.get('/doctor/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const query = { _id: new ObjectId(id) };
                const result = await doctorCollection.findOne(query);

                if (!result) {
                    return res.status(404).json({ message: "Doctor not found" });
                }

                res.json(result);

            } catch (error) {
                console.error("Error occurred:", error);
                res.status(500).json({ message: "Internal server error" });
            }
        });
        // services section
        app.get('/service', async (req, res) => {
            const result = await serviceCollection.find().toArray();
            res.send(result)
        })
        app.get('/service/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await serviceCollection.findOne(query)
            res.send(result)
        })
        // bookings
        app.post('/bookings', async (req, res) => {
            const booking = req.body;
            const result = await bookingsCollection.insertOne(booking);
            res.send(result);
        })
        app.get('/bookings', verifyJWT, async (req, res) => {
            const email = req.query.email;
            if (!email) {
                res.send([])
            }

            const decodedEmail = req.decoded.email
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'forbidden' })
            }

            const query = { email: email }
            const result = await bookingsCollection.find(query).toArray();
            res.send(result);
        })
        app.delete('/bookings/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await bookingsCollection.deleteOne(query)
            res.send(result)
        })
        // payment intent 
        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const { price } = req.body;
            const amount = price * 100;
            // console.log(price, amount)
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })
        // payment information api
        app.post('/payments', verifyJWT, async (req, res) => {
            const payment = req.body;
            const insertResult = await paymentsCollection.insertOne(payment);

            const query = { _id: { $in: payment.bookingId.map(id => new ObjectId(id)) } }

            const deleteResult = await bookingsCollection.deleteMany(query)

            res.send({ insertResult, deleteResult })
        })
        // admin home
        app.get('/admin-status', verifyJWT, verifyAdmin, async (req, res) => {

            const users = await usersCollection.estimatedDocumentCount();
            const doctors = await doctorCollection.estimatedDocumentCount();
            const appointment = await bookingsCollection.estimatedDocumentCount();
            const payments = await paymentsCollection.find().toArray();
            const revenue = payments.reduce((sum, payment) => sum + payment.price, 0)

            res.send({
                users,
                revenue,
                doctors,
                appointment,
            })
        })


        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('doc is sitting')
})
app.listen(port, () => {
    console.log(`doc is sitting on port at ${port}`)
})