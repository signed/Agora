"use strict";
var _ = require("underscore");

module.exports = function (conf) {

  var sympaClient;
  //Just checking if remote has been configured
  if (conf.get('swkTrustedAppName') || conf.get('swkTrustedAppPwd')) {
    sympaClient = require('./sympa')(conf);
  }
  else {
    sympaClient = require('./sympaStub')({});
  }

  var groupstore = require('./groupstore')(conf);
  var async = require('async');
  var Group = require('./group');
  var transformer = require('./sympaTransformer')();

  return {
    getSubscribedGroupsForUser: function (userMail, globalCallback) {
      async.waterfall([
        function (callback) {
          sympaClient.getSubscribedListsForUser(userMail, callback);
        }
      ],
        function (err, subscribedLists) {
          groupstore.groupsByLists(subscribedLists, globalCallback);
        });
    },

    getAllAvailableGroups: function (globalCallback) {
      async.waterfall([
        function (callback) {
          sympaClient.getAllAvailableLists(callback);
        }
      ],
        function (err, allLists) {
          if (err) {
            console.log(err);
          } else {
            groupstore.groupsByLists(allLists, globalCallback);
          }
        });
    },

    getSympaUsersOfList: function (groupname, callback) {
      sympaClient.getUsersOfList(groupname, callback);
    },

    createOrSaveGroup: function (newGroup, globalCallback) {
      this.getGroup(newGroup.id, function (err, existingGroup) {
        async.parallel([
          function (callback) {
            if (!existingGroup) {
              sympaClient.createList(newGroup.id, callback);
            } else {
              callback(null);
            }
          },
          function (callback) {
            groupstore.saveGroup(newGroup, callback);
          }
        ],
          function (err) {
            globalCallback(err, newGroup);
          });
      });
    },

    groupFromObject: function (groupObject) {
      return new Group().fromObject(groupObject);
    },

    updateSubscriptions: function (userMail, oldUserMail, newSubscriptions, globalCallback) {
      async.waterfall([
        function (callback) {
          if (userMail === oldUserMail) {
            sympaClient.getSubscribedListsForUser(userMail, callback);
          } else {
            sympaClient.getSubscribedListsForUser(oldUserMail, callback);
          }
        }
      ],
        function (err, subscribedLists) {
          if (err) {
            return globalCallback(err);
          }
          newSubscriptions = transformer.toArray(newSubscriptions);
          var emailChanged = userMail !== oldUserMail;
          var listsToSubscribe = emailChanged ? newSubscriptions : _.difference(newSubscriptions, subscribedLists);
          var listsToUnsubscribe = emailChanged ? subscribedLists : _.difference(subscribedLists, newSubscriptions);
          async.parallel([
            function (funCallback) {
              var subscribe = function (list, callback) {
                sympaClient.addUserToList(userMail, list, callback);
              };
              async.map(listsToSubscribe, subscribe, funCallback);
            },
            function (funCallback) {
              var unsubscribe = function (list, callback) {
                sympaClient.removeUserFromList(oldUserMail, list, callback);
              };
              async.map(listsToUnsubscribe, unsubscribe, funCallback);
            }
          ],
          function (err) {
            globalCallback(err);
          });
        });
    },

    combineSubscribedAndAvailableGroups: function (subscribedGroups, availableGroups) {
      return availableGroups.map(function (group) {

        var findInSubscribed = function (availableGroup, subscribedGroup) {
          return subscribedGroup.id === availableGroup.id;
        };

        var isSelected = _.some(subscribedGroups, async.apply(findInSubscribed, group));

        return { group: group, selected: isSelected };
      });
    },


    isGroupNameAvailable: function (groupname, callback) {
      var trimmedGroupName = groupname.trim();
      //TODO hgp Muss man hier auch die Sympa Gruppen separat abfragen?
      this.getAllAvailableGroups(function (err, groups) {
        if (err) {
          return callback(err);
        }
        else {
          var available = true;
          groups.forEach(function (group) {

            if (group.id === trimmedGroupName) {
              available = false;
            }

          });
          callback(null, available);
        }
      });
    },

    getGroup: function (groupname, callback) {
      groupstore.getGroup(groupname, callback);
    }
  };
};
