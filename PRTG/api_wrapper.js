/**
 * Grafana Datasource Plugin for PRTG API Interface (ALPHA)
 * API Wrapper; Queries and processes data from the PRTG API
 * 20151206 03:10 Jason Lashua
 * Proof of Concept. Based on publicly available plugins.
 *
 * DOES: Gets data by channel by device. Groups, Devices, Sensors and Channels available.
 * DOES NOT (yet): Trending, Histoic Data, Templating, Annotations
 */
define([
  'angular',
  'lodash',
  './xmlparser'
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.services');

  module.factory('PRTGAPI', function($q, backendSrv) {

    function PRTGAPI(api_url, username, password) {
      this.url              = api_url;
      this.username         = username;
      this.password         = password;
      this.lastId           = false;

    };

    var p = PRTGAPI.prototype;

    /**
     * Request data from PRTG API
     *
     * @param  {string} api interface (e.g., table.json)
     * @param  {object} query parameters
     * @return {object} data.result field or []
     */
    p.performPRTGAPIRequest = function(method, params) {
        var queryString = 'username=' + this.username + '&password=' + this.password + '&' + params;
        var options = {
            method: 'GET',
            url: this.url + '/' + method + '?' + queryString
        };
        var self = this;
        return backendSrv.datasourceRequest(options).then(function (response) {
            if (!response.data) {
                return[];
            }
            else if (response.data.groups) {
                return response.data.groups;
            }
            else if (response.data.devices) {
                return response.data.devices;
            }
            else if (response.data.sensors) {
                return response.data.sensors;
            }
            else if (response.data.channels) {
                return response.data.channels;
            }
            else if (response.data.values) {
                return response.data;
            }
            else if (response.data.sensordata) {
                return response.data.sensordata;
            }
            else {
              //All else is XML
              return new xmlXform(method, response.data)
              //return JSON.parse(response.data);
            }
        });
    };

    p.test = function() {
      alert("test!");
    }
    p.performPRTGAPILogin = function() {
    };

    /**
     * Get the list of host groups
     *
     * @return {array}          array of Zabbix hostgroup objects
     */
    p.performGroupSuggestQuery = function() {
      var params = 'content=groups&columns=objid,group';
      return this.performPRTGAPIRequest('table.json', params);
    };
    p.performDeviceSuggestQuery = function(groupName) {
        var params = 'content=devices&columns=objid,device';
        if (groupName) {
            params += ',group&filter_group=' + groupName;
        }
        return this.performPRTGAPIRequest('table.json', params);
    };
    p.performSensorSuggestQuery = function(deviceId) {
        var params = 'content=sensors&columns=objid,sensor,device,group&id=' + deviceId;
        return this.performPRTGAPIRequest('table.json', params);
    };
    p.performChannelSuggestQuery = function(sensorId) {
        var params = 'content=channels&columns=objid,channel,name&id=' + sensorId;
        return this.performPRTGAPIRequest('table.json', params);
    };

    p.getValuesQuery = function(sensorId, channelIndex, useLive) {
      if (sensorId !== this.lastId) {
        this.lastId = sensorId;
        //code
      }
      if (channelIndex == '!') {
        //getting text info
        var params = "&id=" + sensorId;
        return this.performPRTGAPIRequest('getsensordetails.json', params).then(function (results) {
          var message = results.lastmessage;
          var timestamp = results.lastcheck.replace(/(\s\[[\d\smsago\]]+)/g,'');
          //i dont care about repeating this once
          var dt = Math.round((timestamp - 25569) * 86400,0) * 1000;
          return [message, dt];
        });
      } else {
        var params = "&content=values&sortby=-datetime&columns=datetime,value_&id=" + sensorId;
        //prtg cannot filter individual channels from a sensor, so we do it here.
        if (useLive === true) {
            //the below hack works because providing this argument makes PRTG return the data as if it were making a live graph.
            params = params.concat("&graphid=0"); 
        }
        
        
        return this.performPRTGAPIRequest('table.xml' , params).then(function (results) {
             var result = [];
             var rCnt = results.values.item.length;
             for (var i=0;i<rCnt;i++)
             {
              if (results.values.item[i].value_raw && (results.values.item[i].value_raw.length > channelIndex))
              {
                  var v = results.values.item[i].value_raw[channelIndex].text;
                  //Why PRTG, must you use such a oddball date format? 
                  var dt = Math.round((results.values.item[i].datetime_raw - 25569) * 86400,0) * 1000;
                  result.push([v, dt]);
              }
             }
             return result.reverse();
        });
      }
    }
    return PRTGAPI;

  });

});