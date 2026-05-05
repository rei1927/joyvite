const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://admin:JoyvitePassword123!@192.168.1.100:5432/joyvitedb?schema=public" // Wait, I don't know the exact IP of joyvite-postgres!
    }
  }
});
prisma.weddingConfig.findMany().then(console.log).catch(console.error).finally(()=>prisma.$disconnect());
