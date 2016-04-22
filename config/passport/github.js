var GithubStrategy = require('passport-github').Strategy;
var User           = require('../../models/user');

module.exports = new GithubStrategy({
    clientID     : process.env.GITHUB_ID,
    clientSecret  : process.env.GITHUB_SECRET,
    callbackURL     : '/auth/github/callback',
    passReqToCallback : true // allows us to pass in the req from our route (lets us check if a user is logged in or not)
},
function(req, token, tokenSecret, profile, done) {

    // asynchronous
    process.nextTick(function() {

        // check if the user is already logged in
        if (!req.user) {

            User.findOne({ 'github.id' : profile.id }, function(err, user) {
                if (err)
                    return done(err);

                if (user) {
                    // if there is a user id already but no token (user was linked at one point and then removed)
                    if (!user.github.token) {
                        user.github.token       = token;
                        user.github.username    = profile.username;
                        user.github.displayName = profile.displayName;
                        user.github.email       = (profile.emails[0].value || '').toLowerCase();

                        user.save(function(err) {
                            if (err)
                                return done(err);
                                
                            return done(null, user);
                        });
                    }

                    return done(null, user); // user found, return that user
                } else {
                    // if there is no user, create them
                    var newUser                 = new User();

                    newUser.github.id          = profile.id;
                    newUser.github.token       = token;
                    newUser.github.username    = profile.username;
                    newUser.github.displayName = profile.displayName;
                    newUser.github.email       = (profile.emails[0].value || '').toLowerCase();

                    newUser.save(function(err) {
                        if (err)
                            return done(err);
                            
                        return done(null, newUser);
                    });
                }
            });

        } else {
            // user already exists and is logged in, we have to link accounts
            var user                 = req.user; // pull the user out of the session

            user.github.id          = profile.id;
            user.github.token       = token;
            user.github.username    = profile.username;
            user.github.displayName = profile.displayName;
            user.github.email       = (profile.emails[0].value || '').toLowerCase();

            user.save(function(err) {
                if (err)
                    return done(err);
                    
                return done(null, user);
            });
        }

    });

});