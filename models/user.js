// load the things we need
var mongoose = require('mongoose')
  , Schema   = mongoose.Schema;
var bcrypt   = require('bcrypt-nodejs');

var Key = Schema({
    description: String,
    fingerprint: String,
    key_id: String,
    key: String,
    created: { type: Date, default: Date.now },
});

// define the schema for our user model
var userSchema = Schema({
    name             : String,
    email            : String,
    displayName      : String, //Set to same as name initially
    bio              : String,
    //manual collection references
    following        : [{ type: Schema.Types.ObjectId, ref: 'Collection' }],
    public_keys      : [Key], //first is default
    private_keys     : [Key], //first is default
    local            : {
        password     : String,
    },
    facebook         : {
        id           : String,
        token        : String,
        email        : String,
        name         : String
    },
    twitter          : {
        id           : String,
        token        : String,
        displayName  : String,
        username     : String
    },
    github           : {
        id           : String,
        token        : String,
        email        : String,
        displayName  : String,
        username     : String
    },
    google           : {
        id           : String,
        token        : String,
        email        : String,
        name         : String
    },
    ad               : {
        id           : String,
        name         : String,
        domain       : String
    }

});

userSchema.index({displayName: 'text', bio: 'text', name: 'text'});
userSchema.index({name:1},{unique:true});

//generate default key
userSchema.virtual('default_key').get(function () {
  if (this.private_keys.length > 0)
    return this.private_keys[0].replace(/[\r\n]/g,' ');
  if (this.public_keys.length > 0)
    return this.public_keys[0].replace(/[\r\n]/g,' ');
  return '';
});

// generating a hash
userSchema.methods.generateHash = function(password) {
    return bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
};

// checking if password is valid
userSchema.methods.validPassword = function(password) {
    return bcrypt.compareSync(password, this.local.password);
};

// create the model for users and expose it to our app
module.exports = mongoose.model('User', userSchema);
module.exports.Key = mongoose.model('Key', Key);