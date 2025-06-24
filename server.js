// 1. Cargar las variables de entorno desde .env (DEBE SER LA PRIMERA LÍNEA EJECUTABLE)
require('dotenv').config();

const express = require('express');
const { MongoClient, ObjectId } = require('mongodb'); // Importamos ObjectId
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000; // Usar el puerto de las variables de entorno o 3000 por defecto


const uri = process.env.MONGODB_URI; // La URI de la base de datos se obtiene de las variables de entorno

// Verificar si la URI está definida
if (!uri) {
    console.error('Error: La variable de entorno MONGODB_URI no está definida. Asegúrate de tener un archivo .env con MONGODB_URI.');
    console.error('Para conectar a tu Atlas, el .env debería contener:');
    console.error('MONGODB_URI="mongodb+srv://Jesus:Jesus@paec.guaxwsi.mongodb.net/JESUS?retryWrites=true&w=majority&appName=PAEC"'); // Ejemplo específico para Jesús
    process.exit(1); // Salir si la URI no está definida
}

const client = new MongoClient(uri);

// **ACTUALIZADO: Nombre de la base de datos para el proyecto de Jesús**
const DB_NAME = 'JESUS';
// **ACTUALIZADO: Nombre de la colección (se mantiene RESIDUOS como en tu captura de Compass para la DB JESUS)**
const COLLECTION_NAME = 'RESIDUOS';

let db;

// Conectar a MongoDB una sola vez cuando la aplicación se inicia
async function connectToMongo() {
    try {
        await client.connect();
        db = client.db(DB_NAME);
        console.log(`Conectado a la base de datos: ${DB_NAME}`);
    } catch (err) {
        console.error('Error al conectar a MongoDB:', err);
        process.exit(1); // Salir si no se puede conectar a la BD
    }
}

// Llamar a la función de conexión al iniciar el servidor
connectToMongo();

// Middleware
app.use(express.urlencoded({ extended: true })); // Para parsear application/x-www-form-urlencoded
app.use(express.json()); // MUY IMPORTANTE: Para parsear bodies de JSON enviados desde el frontend (fetch API)
app.use(express.static('public')); // Para servir tus archivos HTML, CSS, JS estáticos

// Ruta principal, sirve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// API ENDPOINTS PARA RESIDUOS

// 1. Obtener todos los residuos (GET /api/residuos)
app.get('/api/residuos', async (req, res) => {
    try {
        if (!db) {
            return res.status(500).json({ message: 'Error: La base de datos no está conectada.' });
        }
        const residuosCollection = db.collection(COLLECTION_NAME);
        const residuos = await residuosCollection.find({}).toArray();
        res.json(residuos); // Enviar los datos como JSON
    } catch (err) {
        console.error('Error al obtener los residuos:', err);
        res.status(500).json({ message: 'Error interno del servidor al obtener residuos: ' + err.message });
    }
});

// 2. Dar de Alta un nuevo Residuo (POST /api/residuos)
app.post('/api/residuos', async (req, res) => {
    // Los datos del nuevo residuo vienen en req.body (ya parseados por express.json())
    // **ACTUALIZADO: Campos para el nuevo esquema de Residuo de Jesús**
    const nuevoResiduo = {
        tipo: req.body.tipo,
        cantidad: req.body.cantidad !== undefined ? Number(req.body.cantidad) : undefined, // Convertir cantidad a número
        estatus: req.body.estatus,
        punto_recoleccion: req.body.punto_recoleccion,
        situacion: req.body.situacion
    };

    // **ACTUALIZADO: Validación de campos requeridos para el nuevo esquema**
    if (!nuevoResiduo.tipo || nuevoResiduo.cantidad === undefined || !nuevoResiduo.estatus || !nuevoResiduo.punto_recoleccion || !nuevoResiduo.situacion) {
        return res.status(400).json({ message: 'Faltan campos requeridos para el nuevo residuo (tipo, cantidad, estatus, punto_recoleccion, situacion).' });
    }

    try {
        if (!db) {
            return res.status(500).json({ message: 'Error: La base de datos no está conectada.' });
        }
        const residuosCollection = db.collection(COLLECTION_NAME);
        const result = await residuosCollection.insertOne(nuevoResiduo);
        console.log('Nuevo residuo insertado:', result.insertedId);
        res.status(201).json({ message: 'Residuo agregado con éxito.', id: result.insertedId });
    } catch (err) {
        console.error('Error al insertar residuo:', err);
        res.status(500).json({ message: 'Error interno del servidor al insertar residuo: ' + err.message });
    }
});

// 3. Actualizar un Residuo (PUT /api/residuos/:id)
// Usaremos el _id para identificar el residuo a actualizar
app.put('/api/residuos/:id', async (req, res) => {
    const residuoId = req.params.id; // El ID viene de la URL
    const datosAActualizar = req.body; // Los datos vienen en el body (JSON)

    if (!residuoId) {
        return res.status(400).json({ message: 'ID de residuo es requerido para la actualización.' });
    }

    // Convertir _id string a ObjectId
    let objectId;
    try {
        objectId = new ObjectId(residuoId);
    } catch (e) {
        return res.status(400).json({ message: 'ID de residuo inválido.' });
    }

    // Preparar el documento de actualización, manejando tipos si es necesario
    const updateDoc = { $set: {} };
    for (const key in datosAActualizar) {
        if (datosAActualizar.hasOwnProperty(key)) {
            // Convertir 'cantidad' a número
            if (key === 'cantidad') {
                updateDoc.$set[key] = Number(datosAActualizar[key]);
            }
            // **REMOVIDO: No hay fecha_registro, unidad_medida, ubicacion en el nuevo esquema**
            // else if (key === 'fecha_registro' || key === 'unidad_medida' || key === 'ubicacion') {
            //     // Lógica para campos que ya no existen, no se incluye
            // }
            else {
                updateDoc.$set[key] = datosAActualizar[key];
            }
        }
    }

    // No permitir actualizar el _id
    delete updateDoc.$set._id;

    if (Object.keys(updateDoc.$set).length === 0) {
        return res.status(400).json({ message: 'No se proporcionaron datos para actualizar.' });
    }

    try {
        if (!db) {
            return res.status(500).json({ message: 'Error: La base de datos no está conectada.' });
        }
        const residuosCollection = db.collection(COLLECTION_NAME);
        
        const result = await residuosCollection.updateOne(
            { _id: objectId },
            updateDoc
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'Residuo no encontrado.' });
        }
        if (result.modifiedCount === 0) {
            return res.status(200).json({ message: 'Residuo encontrado, pero no se realizaron cambios (el valor ya era el mismo o no hay datos nuevos).' });
        }

        console.log('Residuo actualizado con ID:', residuoId);
        res.status(200).json({ message: 'Residuo actualizado con éxito.' });
    } catch (err) {
        console.error('Error al actualizar residuo:', err);
        res.status(500).json({ message: 'Error interno del servidor al actualizar residuo: ' + err.message });
    }
});


// 4. Eliminar un Residuo (DELETE /api/residuos/:id)
// Usaremos el _id para identificar el residuo a eliminar
app.delete('/api/residuos/:id', async (req, res) => {
    const residuoId = req.params.id; // El ID viene de la URL

    if (!residuoId) {
        return res.status(400).json({ message: 'ID de residuo es requerido para la eliminación.' });
    }

    // Convertir _id string a ObjectId
    let objectId;
    try {
        objectId = new ObjectId(residuoId);
    } catch (e) {
        return res.status(400).json({ message: 'ID de residuo inválido.' });
    }

    try {
        if (!db) {
            return res.status(500).json({ message: 'Error: La base de datos no está conectada.' });
        }
        const residuosCollection = db.collection(COLLECTION_NAME);
        
        const result = await residuosCollection.deleteOne({ _id: objectId });

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Residuo no encontrado para eliminar.' });
        }

        console.log('Residuo eliminado con ID:', residuoId);
        res.status(200).json({ message: 'Residuo eliminado con éxito.' });
    } catch (err) {
        console.error('Error al eliminar residuo:', err);
        res.status(500).json({ message: 'Error interno del servidor al eliminar residuo: ' + err.message });
    }
});


// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Servidor de Gestión de Residuos corriendo en http://localhost:${PORT}`);
    console.log(`Abre tu navegador en http://localhost:${PORT} para acceder a la aplicación.`);
});

// Manejar el cierre de la conexión de MongoDB cuando la aplicación se detenga
process.on('SIGINT', async () => {
    console.log('Cerrando conexión a MongoDB...');
    if (client) {
        await client.close();
    }
    console.log('Conexión a MongoDB cerrada.');
    process.exit(0);
});
