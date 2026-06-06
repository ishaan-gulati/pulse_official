# 🏷️ **Tag-Based Role System Guide**

## 🎯 **How It Works:**

Instead of hardcoding roles in the app, you can now **manage user permissions and badges directly in Firestore** by adding/removing tags!

## 📱 **What You Can Do:**

### **Add Tags to Users:**
1. **Go to Firebase Console** → **Firestore Database**
2. **Navigate to** `users/{userId}`
3. **Add a new field** called `tags` (array of strings)
4. **Add any tags** you want: `['founder', 'admin', 'verified']`

### **Remove Tags:**
1. **Edit the user document**
2. **Remove tags** from the array
3. **Save** - changes appear instantly in the app!

## 🏆 **Available Badge Types:**

| Tag | Badge | Color | Icon | Description |
|-----|-------|-------|------|-------------|
| `founder` | 🏆 FOUNDER | Gold | Trophy | App creator |
| `admin` | 🛡️ ADMIN | Red | Shield | Platform administrator |
| `verified` | ✅ VERIFIED | Green | Checkmark | Verified user |
| `moderator` | ⭐ MODERATOR | Purple | Star | Content moderator |
| `premium` | 💎 PREMIUM | Orange | Diamond | Premium subscriber |

## 🔧 **How to Add Tags in Firestore:**

### **Method 1: Firebase Console**
1. **Firestore Database** → **Data** tab
2. **Click on user document** (e.g., `users/TxS3MuxYN0MfxYJhEhD1hVgEQFA2`)
3. **Add field** `tags` (type: array)
4. **Add values**: `founder`, `admin`, `verified`
5. **Click "Update"**

### **Method 2: Programmatically**
```typescript
// Add tags to a user
await userService.updateUserProfile(uid, {
  tags: ['founder', 'admin', 'verified']
});

// Remove specific tag
const currentTags = userProfile.tags.filter(tag => tag !== 'admin');
await userService.updateUserProfile(uid, { tags: currentTags });
```

## 📊 **Example User Document:**

```json
{
  "uid": "TxS3MuxYN0MfxYJhEhD1hVgEQFA2",
  "username": "ishaan123",
  "displayName": "Ishaan Gulati",
  "email": "ishaan1gulati@gmail.com",
  "tags": ["founder", "admin", "verified"],
  "customBadges": ["🏆 FOUNDER"],
  "totalPortfolioValue": 10000,
  "totalReturn": 0,
  "createdAt": "2024-01-01T00:00:00Z"
}
```

## 🎨 **Custom Badges:**

You can also add custom badge text:
1. **Add field** `customBadges` (array of strings)
2. **Add custom text**: `["🏆 FOUNDER", "🌟 SPECIAL USER"]`
3. **App will display** your custom badge text

## 🚀 **Benefits of This System:**

### **✅ No Code Changes Needed:**
- Add/remove roles instantly
- New badges appear automatically
- Flexible permission system

### **✅ Easy Management:**
- Firebase console interface
- Real-time updates
- Bulk operations possible

### **✅ Scalable:**
- Add unlimited tags
- Custom badge text
- Future-proof design

## 🎯 **Common Use Cases:**

### **Make Someone Admin:**
```
tags: ["admin", "verified"]
```

### **Remove Admin Access:**
```
tags: ["verified"]  // Remove "admin" tag
```

### **Add Premium User:**
```
tags: ["premium", "verified"]
```

### **Special Event Badge:**
```
tags: ["founder", "event-organizer"]
customBadges: ["🏆 FOUNDER", "🎉 EVENT HOST"]
```

## 🔒 **Security Note:**

- **Tags are public** - anyone can see them
- **Don't store sensitive info** in tags
- **Use for display purposes** and basic permissions
- **Implement proper security** in your app logic

## 📱 **What Users See:**

- **Founder badge** 🏆 next to your name
- **Admin badge** 🛡️ if you have admin tag
- **Verified badge** ✅ for verified users
- **Multiple badges** can be displayed at once
- **Automatic updates** when you change tags

## 🎉 **Try It Now:**

1. **Go to Firebase Console**
2. **Find your user document**
3. **Add tags**: `["founder", "admin"]`
4. **Refresh your app**
5. **See the badges appear!**

**This system gives you complete control over user roles without touching the code!** 🚀
