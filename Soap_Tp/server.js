const soap = require('soap');
const fs = require('fs');
const http = require('http');
const postgres = require('postgres');

const sql = postgres({ db: 'mydb', user: 'user', password: 'password', port: 5470 });

// Implémentation du service SOAP
const service = {
  ProductsService: {
    ProductsPort: {
      // Créer un produit
      CreateProduct: async function ({ name, about, price }, callback) {
        try {
          const result = await sql`
            INSERT INTO products (name, about, price)
            VALUES (${name}, ${about}, ${price})
            RETURNING *`;
          callback(null, result[0]);
        } catch (error) {
          callback({ faultString: 'Database Error', detail: error.message });
        }
      },

      // Récupérer tous les produits
      GetProducts: async function (args, callback) {
        try {
          const products = await sql`SELECT * FROM products`;
          callback(null, { products });
        } catch (error) {
          callback({ faultString: 'Database Error', detail: error.message });
        }
      },

      // Mettre à jour un produit partiellement avec des conditions
      PatchProduct: async function ({ id, name, about, price }, callback) {
        try {
          if (!id) {
            return callback({ faultString: "L'ID du produit est requis pour la mise à jour." });
          }

          console.log(`Vérification du produit avec l'ID: ${id}`);

          // Vérifier si le produit existe
          const productExists = await sql`SELECT * FROM products WHERE id = ${id}`;
          console.log('Produit trouvé :', productExists);

          if (productExists.length === 0) {
            return callback({ faultString: "Produit non trouvé." });
          }

          const updates = [];
          const values = [id];

          if (name !== undefined) {
            updates.push(`name = $${values.length + 1}`);
            values.push(name);
          }
          if (about !== undefined) {
            updates.push(`about = $${values.length + 1}`);
            values.push(about);
          }
          if (price !== undefined) {
            updates.push(`price = $${values.length + 1}`);
            values.push(price);
          }

          if (updates.length === 0) {
            return callback({ faultString: "Aucune donnée fournie pour la mise à jour." });
          }

          const query = `
            UPDATE products
            SET ${updates.join(", ")}
            WHERE id = $1
            RETURNING *;
          `;
          console.log('Requête SQL :', query);

          const result = await sql.unsafe(query, values);
          console.log('Résultat de la mise à jour :', result);

          callback(null, result[0]);
        } catch (error) {
          callback({ faultString: 'Database Error', detail: error.message });
        }
      },

      // Supprimer un produit
      DeleteProduct: async function ({ id }, callback) {
        try {
          if (!id) {
            return callback({ faultString: "L'ID est requis pour la suppression." });
          }

          console.log(`Vérification du produit à supprimer avec l'ID: ${id}`);

          // Vérifier si le produit existe avant de le supprimer
          const productExists = await sql`SELECT * FROM products WHERE id = ${id}`;
          console.log('Produit à supprimer :', productExists);

          if (productExists.length === 0) {
            return callback({ faultString: "Produit non trouvé." });
          }

          const deletedProduct = await sql`
            DELETE FROM products WHERE id = ${id} RETURNING *`;
          console.log('Produit supprimé :', deletedProduct);

          callback(null, { message: "Produit supprimé avec succès." });
        } catch (error) {
          callback({ faultString: 'Database Error', detail: error.message });
        }
      }
    }
  }
};

// Lire le WSDL
const xml = fs.readFileSync('productsService.wsdl', 'utf8');

// Créer un serveur HTTP
const server = http.createServer((request, response) => {
  if (request.url === '/products?wsdl') {
    response.writeHead(200, { 'Content-Type': 'text/xml' });
    response.end(xml);
  } else {
    response.statusCode = 404;
    response.end('404: Not Found: ' + request.url);
  }
});

// Lancer le serveur
server.listen(8000, () => {
  console.log('SOAP server running at http://localhost:8000');
});

// Lancer le service SOAP
soap.listen(server, '/products', service, xml);
