import { userService } from './userService';

// Example functions for managing user tags
export const tagExamples = {
  // Make a user an admin
  async makeUserAdmin(uid: string): Promise<void> {
    try {
      await userService.addUserTag(uid, 'admin');
      console.log('User is now an admin!');
    } catch (error) {
      console.error('Failed to make user admin:', error);
    }
  },

  // Remove admin access
  async removeAdminAccess(uid: string): Promise<void> {
    try {
      await userService.removeUserTag(uid, 'admin');
      console.log('Admin access removed!');
    } catch (error) {
      console.error('Failed to remove admin access:', error);
    }
  },

  // Make a user verified
  async verifyUser(uid: string): Promise<void> {
    try {
      await userService.addUserTag(uid, 'verified');
      console.log('User is now verified!');
    } catch (error) {
      console.error('Failed to verify user:', error);
    }
  },

  // Add premium status
  async addPremiumStatus(uid: string): Promise<void> {
    try {
      await userService.addUserTag(uid, 'premium');
      console.log('User is now premium!');
    } catch (error) {
      console.error('Failed to add premium status:', error);
    }
  },

  // Set multiple tags at once
  async setUserRole(uid: string, role: 'user' | 'moderator' | 'admin' | 'founder'): Promise<void> {
    try {
      const tags = ['verified']; // All users get verified by default
      
      switch (role) {
        case 'moderator':
          tags.push('moderator');
          break;
        case 'admin':
          tags.push('admin', 'moderator');
          break;
        case 'founder':
          tags.push('founder', 'admin', 'moderator');
          break;
        default:
          // Just verified
          break;
      }
      
      await userService.setUserTags(uid, tags);
      console.log(`User role set to: ${role}`);
    } catch (error) {
      console.error('Failed to set user role:', error);
    }
  },

  // Get all admins
  async getAllAdmins(): Promise<void> {
    try {
      const admins = await userService.getUsersByTag('admin');
      console.log('All admins:', admins.map(u => u.displayName));
    } catch (error) {
      console.error('Failed to get admins:', error);
    }
  },

  // Get all verified users
  async getAllVerifiedUsers(): Promise<void> {
    try {
      const verified = await userService.getUsersByTag('verified');
      console.log('All verified users:', verified.map(u => u.displayName));
    } catch (error) {
      console.error('Failed to get verified users:', error);
    }
  }
};

// Example usage:
/*
// Make someone an admin
await tagExamples.makeUserAdmin('user-uid-here');

// Set a user as moderator
await tagExamples.setUserRole('user-uid-here', 'moderator');

// Get all admins
await tagExamples.getAllAdmins();
*/
