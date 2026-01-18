import dotenv from 'dotenv';
import path from 'path';

// Load env vars immediately
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import app from './app';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
