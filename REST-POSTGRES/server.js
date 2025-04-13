import express from "express";
import postgres from "postgres";
import { z } from "zod";
import crypto from "crypto";
import fetch from "node-fetch";
import swaggerUi from "swagger-ui-express";
import swaggerJSDoc from "swagger-jsdoc";

const app = express();
const port = 8000;

const sql = postgres({ db: "mydb", user: "user", password: "password", port: 5470 });
app.use(express.json());

// ---------------------- Swagger Configuration ----------------------

const swaggerOptions = {
  definition: {
    openapi: "3.0.0", 
    info: {
      title: "API de produits et commandes", 
      version: "1.0.0", 
    },
  },
  apis: ["server.mjs"], // 
};

const swaggerDocs = swaggerJSDoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// ---------------------- Schemas ----------------------

const ProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  about: z.string(),
  price: z.number().positive(),
});
const CreateProductSchema = ProductSchema.omit({ id: true });

const UserSchema = z.object({
  id: z.number(),
  username: z.string(),
  email: z.string().email(),
});
const CreateUserSchema = z.object({
  username: z.string(),
  email: z.string().email(),
  password: z.string().min(6),
});
const UpdateUserSchema = z.object({
  username: z.string().optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
});

const ReviewSchema = z.object({
  product_id: z.number(),
  user_id: z.number(),
  score: z.number().min(1).max(5),
  content: z.string().optional(),
});

function hashPassword(password) {
  return crypto.createHash("sha512").update(password).digest("hex");
}

// ---------------------- Products ----------------------

/**
 * @swagger
 * /products:
 *   get:
 *     summary: "Obtenir tous les produits"
 *     description: "Cette route permet de récupérer la liste de tous les produits disponibles dans l'API."
 *     parameters:
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: "Filtrer les produits par nom."
 *       - in: query
 *         name: about
 *         schema:
 *           type: string
 *         description: "Filtrer les produits par description."
 *       - in: query
 *         name: price
 *         schema:
 *           type: number
 *           format: float
 *         description: "Filtrer les produits par prix maximum."
 *     responses:
 *       200:
 *         description: "Liste des produits retournée avec succès"
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   name:
 *                     type: string
 *                   about:
 *                     type: string
 *                   price:
 *                     type: number
 *                     format: float
 */
app.get("/products", async (req, res) => {
  const { name, about, price } = req.query;

  const conditions = [];
  if (name) {
    conditions.push(sql`name ILIKE ${'%' + name + '%'}`);
  }
  if (about) {
    conditions.push(sql`about ILIKE ${'%' + about + '%'}`);
  }
  if (price) {
    const parsedPrice = parseFloat(price);
    if (!isNaN(parsedPrice)) {
      conditions.push(sql`price <= ${parsedPrice}`);
    }
  }

  try {
    const query = conditions.length > 0
      ? sql`SELECT * FROM products WHERE ${sql.join(conditions, sql` AND `)}`
      : sql`SELECT * FROM products`;

    const products = await query;
    if (products.length === 0) {
      return res.status(404).json({ message: "Aucun produit trouvé" });
    }
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la récupération des produits" });
  }
});



// ---------------------- Users ----------------------

/**
 * @swagger
 * /users:
 *   post:
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       201:
 *         description: "Utilisateur créé avec succès"
 *       400:
 *         description: "Demande invalide"
 */
app.post("/users", async (req, res) => {
  const result = CreateUserSchema.safeParse(req.body);
  if (!result.success) return res.status(400).send(result);

  const { username, email, password } = result.data;
  const hashedPassword = hashPassword(password);

  try {
    const user = await sql`
      INSERT INTO users (username, email, password)
      VALUES (${username}, ${email}, ${hashedPassword})
      RETURNING id, username, email
    `;
    res.status(201).send(user[0]);
  } catch (error) {
    res.status(500).send({ error: "Erreur lors de la création de l'utilisateur" });
  }
});

// ---------------------- Reviews ----------------------

/**
 * @swagger
 * /reviews:
 *   post:
 *     summary: "Créer un avis sur un produit"
 *     description: "Cette route permet aux utilisateurs de soumettre un avis pour un produit."
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               product_id:
 *                 type: integer
 *               user_id:
 *                 type: integer
 *               score:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               content:
 *                 type: string
 *     responses:
 *       201:
 *         description: "Avis créé avec succès"
 *       400:
 *         description: "Demande invalide"
 */
app.post("/reviews", async (req, res) => {
  const result = ReviewSchema.safeParse(req.body);
  if (result.success) {
    const { product_id, user_id, score, content } = result.data;

    try {
      const review = await sql`
        INSERT INTO reviews (product_id, user_id, score, content)
        VALUES (${product_id}, ${user_id}, ${score}, ${content})
        RETURNING *
      `;
      res.status(201).send(review[0]);
    } catch (error) {
      res.status(500).send({ error: "Erreur lors de la création de l'avis" });
    }
  } else {
    res.status(400).send(result);
  }
});


app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
