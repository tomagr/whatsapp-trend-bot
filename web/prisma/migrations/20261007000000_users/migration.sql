-- CreateTable: people who signed in (recorded on each Google sign-in); superadmins see runs and users in /admin
CREATE TABLE "User" (
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "superadmin" BOOLEAN NOT NULL DEFAULT false,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("email")
);

-- The first superadmin
INSERT INTO "User" ("email", "name", "superadmin") VALUES ('tomas@amalgama.co', 'Tomas Agrimbau', true);
