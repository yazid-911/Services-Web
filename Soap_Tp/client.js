const soap = require("soap");

soap.createClient("http://localhost:8000/products?wsdl", {}, function (err, client) {
  if (err) {
    console.error("Error creating SOAP client:", err);
    return;
  }

  // Créer un produit avec l'ID 1
  client.CreateProduct({ name: "Product 1", about: "Description du produit", price: 20 }, function (err, result) {
    if (err) {
      console.error("Error creating product:", err);
    } else {
      console.log("Created Product:", result);
    }

    // Test de PatchProduct après la création
    client.PatchProduct({ id: "2", name: "Updated Product" }, function (err, result) {
      if (err) {
        console.error("Error updating product:", err);
      } else {
        console.log("Updated Product:", result);
      }
    });

    // Test de DeleteProduct après la mise à jour
    client.DeleteProduct({ id: "2" }, function (err, result) {
      if (err) {
        console.error("Error deleting product:", err);
      } else {
        console.log("Deleted Product:", result);
      }
    });
  });
});
