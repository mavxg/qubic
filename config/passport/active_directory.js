var CustomStrategy = require('passport-custom').Strategy;
var User           = require('../../models/user');

module.exports = new CustomStrategy((req, done) => {
    //TODO: Is that vvvv how you are supposed to use flash?
    if (req.ntlm==undefined || req.ntlm.UserName==='')
        return done(null, false,
            req.flash('loginMessage', 'AD authentication failed.'));

    // asynchronous
    process.nextTick(function() {
        var id = (req.ntlm.DomainName + '\\' + req.ntlm.UserName).toLowerCase();
        // check if the user is already logged in
        if (!req.user) {
            User.findOne({ 'ad.id' : id }, function(err, user) {
                if (err)
                    return done(err);

                if (user) {
                    return done(null, user);
                } else {
                    // if there is no user, create them
                    var newUser       = new User();
                    newUser.name      = req.ntlm.UserName.toLowerCase();
                    newUser.ad.id     = id;
                    newUser.ad.name   = req.ntlm.UserName;
                    newUser.ad.domain = req.ntlm.DomainName;

                    newUser.save(function(err) {
                        if (err)
                            return done(err);

                        return done(null, newUser);
                    });
                }
            });
        } else {
            // user already exists and is logged in, we have to link accounts
            var user       = req.user; // pull the user out of the session

            user.ad.id     = id;
            user.ad.name   = req.ntlm.UserName;
            user.ad.domain = req.ntlm.DomainName;

            user.save(function(err) {
                if (err)
                    return done(err);

                return done(null, user);
            });

        }
    });

});