'use strict';

const conf = require('simple-configure');
const beans = conf.get('beans');
const membersService = beans.get('membersService');

function createUserObject(req, authenticationId, profile, done) {
  process.nextTick(membersService.findMemberFor(req.user, authenticationId, (err, member) => {
    if (err) { return done(err); }
    if (!member) { return done(null, {authenticationId, profile}); }
    return done(null, {authenticationId, member});
  }));
}

module.exports = {
  createUserObjectFromOpenID: (req, authenticationId, openidProfile, done) => {
    const minimalProfile = openidProfile &&
      {
        emails: openidProfile.emails && [openidProfile.emails[0]],
        name: openidProfile.name,
        profileUrl: openidProfile.profileUrl
      };

    createUserObject(req, authenticationId, minimalProfile, done);
  },

  createUserObjectFromGithub: (req, accessToken, refreshToken, githubProfile, done) => {
    const minimalProfile = githubProfile &&
      {
        emails: [githubProfile._json.email],
        profileUrl: githubProfile.profileUrl,
        _json: {
          blog: githubProfile._json && githubProfile._json.blog
        }
      };

    createUserObject(req, githubProfile.provider + ':' + githubProfile.id, minimalProfile, done);
  },

  createUserObjectFromGooglePlus: (req, iss, sub, profile, jwtClaims, accessToken, refreshToken, params, done) => {
    /* eslint no-underscore-dangle: 0 */
    const googleProfile = profile._json;
    const minimalProfile = googleProfile && {
      emails: googleProfile.emails && [googleProfile.emails[0]],
      name: googleProfile.name,
      profileUrl: googleProfile.url
    };

    createUserObject(req, 'https://plus.google.com/' + sub, minimalProfile, done);
  },

  createUserObjectFromMagicLink: (req, authenticationId, done) => {
    createUserObject(req, authenticationId, {}, done);
  }
};
