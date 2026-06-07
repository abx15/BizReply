import dotenv from 'dotenv';
import dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);
import mongoose from 'mongoose';
import { Business } from '../src/models/Business';

dotenv.config({ override: true });

async function changePlan() {
  // Read command line arguments: npm run change-plan <email> <plan>
  const args = process.argv.slice(2);
  const email = args[0];
  const newPlan = args[1] as 'free' | 'starter' | 'pro';

  if (!email || !newPlan) {
    console.log('Error: Missing arguments.');
    console.log('Usage: npx ts-node scratch/change_plan.ts <business_email> <free|starter|pro>');
    process.exit(1);
  }

  if (!['free', 'starter', 'pro'].includes(newPlan)) {
    console.log(`Error: Invalid plan name "${newPlan}". Choose from: free, starter, pro`);
    process.exit(1);
  }

  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('MONGO_URI is missing from environment.');
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB Atlas...');

    const business = await Business.findOne({ email });
    if (!business) {
      console.log(`Error: No business found with email "${email}"`);
      return;
    }

    console.log(`Current Plan for ${business.name} (${email}): "${business.plan}"`);
    
    // Update the plan
    business.plan = newPlan;
    
    // If upgrading from free, we might want to clear trialEndsAt or set it to null
    if (newPlan !== 'free') {
      business.trialEndsAt = null;
    } else {
      // Re-establishing a 30-day trial for free plan if needed
      business.trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }

    await business.save();
    console.log(`✔ Plan successfully updated to: "${business.plan}"`);
    console.log(`  Trial Ends At: ${business.trialEndsAt ? business.trialEndsAt.toLocaleDateString() : 'Active/Lifetime'}`);

  } catch (err: any) {
    console.error('✘ Error updating plan:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

changePlan();
