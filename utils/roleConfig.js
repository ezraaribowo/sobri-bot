const fs = require('fs');
const path = require('path');

class RoleConfigManager {
  constructor() {
    this.configFile = path.join(__dirname, '.', 'data', 'roleConfig.json');
    this.ensureDataDirectory();
    this.loadConfig();
  }

  ensureDataDirectory() {
    const dataDir = path.dirname(this.configFile);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  loadConfig() {
    try {
      if (fs.existsSync(this.configFile)) {
        const data = fs.readFileSync(this.configFile, 'utf8');
        this.config = JSON.parse(data);
      } else {
        this.config = {
          vfsRoleId: null,
          gvgRoleId: null
        };
        this.saveConfig();
      }
    } catch (error) {
      console.error('Error loading role config:', error);
      this.config = {
        vfsRoleId: null,
        gvgRoleId: null
      };
    }
  }

  saveConfig() {
    try {
      fs.writeFileSync(this.configFile, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error('Error saving role config:', error);
    }
  }

  setVfsRole(roleId) {
    this.config.vfsRoleId = roleId;
    this.saveConfig();
  }

  setGvgRole(roleId) {
    this.config.gvgRoleId = roleId;
    this.saveConfig();
  }

  getVfsRole() {
    return this.config.vfsRoleId;
  }

  getGvgRole() {
    return this.config.gvgRoleId;
  }

  getVfsRoleMention() {
    return this.config.vfsRoleId ? `<@&${this.config.vfsRoleId}>` : null;
  }

  getGvgRoleMention() {
    return this.config.gvgRoleId ? `<@&${this.config.gvgRoleId}>` : null;
  }

  getRoleMentionForCategory(category) {
    if (category === 'guildwars') {
      return this.getGvgRoleMention();
    } else {
      // For VFS events (public, guild, both)
      return this.getVfsRoleMention();
    }
  }

  getAllConfig() {
    return { ...this.config };
  }

  clearVfsRole() {
    this.config.vfsRoleId = null;
    this.saveConfig();
  }

  clearGvgRole() {
    this.config.gvgRoleId = null;
    this.saveConfig();
  }
}

module.exports = RoleConfigManager;
