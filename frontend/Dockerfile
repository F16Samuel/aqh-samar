# ==========================================
# Stage 1: Build stage
# ==========================================
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files to install dependencies
COPY package*.json ./
RUN npm ci

# Copy the rest of the source code
COPY . .

# Embed Vite build-time environment arguments (Vercel/ECS defaults)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_API_BASE_URL

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Compile the TanStack Start production bundle
RUN npm run build

# ==========================================
# Stage 2: Lightweight Runner stage
# ==========================================
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy only the compiled output from the builder stage
COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Expose port 3000 for the frontend
EXPOSE 3000

# Start the high-performance SSR server
CMD ["node", "dist/server/server.js"]
