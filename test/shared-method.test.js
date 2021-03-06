// Copyright IBM Corp. 2014,2016. All Rights Reserved.
// Node module: strong-remoting
// This file is licensed under the Artistic License 2.0.
// License text available at https://opensource.org/licenses/Artistic-2.0

var assert = require('assert');
var extend = require('util')._extend;
var expect = require('chai').expect;
var SharedMethod = require('../lib/shared-method');
var factory = require('./helpers/shared-objects-factory.js');
var Promise = global.Promise || require('bluebird');

describe('SharedMethod', function() {
  var STUB_CLASS = {};
  var STUB_METHOD = function(cb) { cb(); };

  describe('constructor', function() {
    it('normalizes "array" type in "accepts" arguments', function() {
      var sharedMethod = new SharedMethod(STUB_METHOD, 'a-name', STUB_CLASS, {
        accepts: { arg: 'data', type: 'array' }
      });

      expect(sharedMethod.accepts).to.eql([
        { arg: 'data', type: ['any'] }
      ]);
    });

    it('normalizes "array" type in "returns" arguments', function() {
      var sharedMethod = new SharedMethod(STUB_METHOD, 'a-name', STUB_CLASS, {
        returns: { arg: 'data', type: 'array' }
      });

      expect(sharedMethod.returns).to.eql([
        { arg: 'data', type: ['any'] }
      ]);
    });

    it('passes along `documented` flag correctly', function() {
      var sharedMethod = new SharedMethod(STUB_METHOD, 'a-name', STUB_CLASS, {
        documented: false
      });

      expect(sharedMethod.documented).to.eql(false);
    });
  });

  describe('sharedMethod.isDelegateFor(suspect, [isStatic])', function() {

    // stub function
    function myFunction() {}

    it('checks if the given function is going to be invoked', function() {
      var mockSharedClass = {};
      var sharedMethod = new SharedMethod(myFunction, 'myName', mockSharedClass);
      assert.equal(sharedMethod.isDelegateFor(myFunction), true);
    });

    it('checks by name if a function is going to be invoked', function() {
      var mockSharedClass = { prototype: { myName: myFunction } };
      var sharedMethod = new SharedMethod(myFunction, 'myName', mockSharedClass);
      assert.equal(sharedMethod.isDelegateFor('myName', false), true);
      assert.equal(sharedMethod.isDelegateFor('myName', true), false);
      assert.equal(sharedMethod.isDelegateFor('myName'), true);
    });

    it('checks by name if static function is going to be invoked', function() {
      var mockSharedClass = { myName: myFunction };
      var options = { isStatic: true };
      var sharedMethod = new SharedMethod(myFunction, 'myName', mockSharedClass, options);
      assert.equal(sharedMethod.isDelegateFor('myName', true), true);
      assert.equal(sharedMethod.isDelegateFor('myName', false), false);
    });

    it('checks by alias if static function is going to be invoked', function() {
      var mockSharedClass = { myName: myFunction };
      var options = { isStatic: true, aliases: ['myAlias'] };
      var sharedMethod = new SharedMethod(myFunction, 'myName', mockSharedClass, options);
      assert.equal(sharedMethod.isDelegateFor('myAlias', true), true);
      assert.equal(sharedMethod.isDelegateFor('myAlias', false), false);
    });

    it('checks if the given name is a string', function() {
      var mockSharedClass = {};
      var err;
      try {
        var sharedMethod = new SharedMethod(myFunction, Number, mockSharedClass);
      } catch (e) {
        err = e;
      }
      assert(err);
    });
  });

  describe('sharedMethod.invoke', function() {
    it('returns 400 when number argument is `NaN`', function(done) {
      var method = givenSharedMethod({
        accepts: { arg: 'num', type: 'number' },
      });

      method.invoke('ctx', { num: NaN }, function(err) {
        setImmediate(function() {
          expect(err).to.exist;
          expect(err.message).to.contain('num must be a number');
          expect(err.statusCode).to.equal(400);
          done();
        });
      });
    });
    describe('data type: integer', function() {
      describe('SharedMethod.getType - determine actual type based on value', function() {
        it('returns type: number for decimal value & integer target type',
          function() {
            expect(SharedMethod.getType(15.2, 'integer')).to.equal('number');
          });
        it('returns type:integer for intiger value & integer target type',
          function() {
            expect(SharedMethod.getType(14, 'integer')).to.equal('integer');
          });
      });

      it('returns 400 when integer argument is a decimal number',
        function(done) {
          var method = givenSharedMethod({
            accepts: { arg: 'num', type: 'integer' },
          });

          method.invoke('ctx', { num: 2.5 }, function(err) {
            setImmediate(function() {
              expect(err).to.exist;
              expect(err.message).to.match(/integer/i);
              expect(err.statusCode).to.equal(400);
              done();
            });
          });
        });

      it('returns 400 when integer argument is `NaN`', function(done) {
        var method = givenSharedMethod({
          accepts: { arg: 'num', type: 'integer' },
        });

        method.invoke('ctx', { num: NaN }, function(err) {
          setImmediate(function() {
            expect(err).to.exist;
            expect(err.message).to.match(/integer/i);
            expect(err.statusCode).to.equal(400);
            done();
          });
        });
      });

      it('returns 400 when integer argument is not a safe integer',
        function(done) {
          var method = givenSharedMethod(
            function(arg, cb) {
              return cb({ 'num': arg });
            },
            {
              accepts: { arg: 'num', type: 'integer' },
            });

          method.invoke('ctx', { num: 2343546576878989879789 }, function(err) {
            setImmediate(function() {
              expect(err).to.exist;
              expect(err.message).to.match(/integer/i);
              expect(err.statusCode).to.equal(400);
              done();
            });
          });
        });

      it('treats integer argument of type x.0 as integer', function(done) {
        var method = givenSharedMethod(
          function(arg, cb) {
            return cb({ 'num': arg });
          },
          {
            accepts: { arg: 'num', type: 'integer' },
          });

        method.invoke('ctx', { num: '12.0' }, function(result) {
          setImmediate(function() {
            expect(result.num).to.equal(12);
            done();
          });
        });
      });

      it('returns 500 for non-integer return value if type: `integer`',
        function(done) {
          var method = givenSharedMethod(
            function(cb) {
              cb(null, 3.141);
            },
            {
              returns: { arg: 'value', type: 'integer' },
            });

          method.invoke('ctx', {}, function(err, result) {
            setImmediate(function() {
              expect(err).to.exist;
              expect(err.message).to.match(/integer/i);
              expect(err.statusCode).to.equal(500);
              done();
            });
          });
        });

      it('returns 500 if returned value is not a safe integer', function(done) {
        var method = givenSharedMethod(
          function(cb) {
            cb(null, -2343546576878989879789);
          },
          {
            returns: { arg: 'value', type: 'integer' },
          });

        method.invoke('ctx', {}, function(err, result) {
          setImmediate(function() {
            expect(err).to.exist;
            expect(err.message).to.match(/safe integer/i);
            expect(err.statusCode).to.equal(500);
            done();
          });
        });
      });
    });

    it('returns 400 and doesn\'t crash with unparsable object', function(done) {
      var method = givenSharedMethod({
        accepts: [{ arg: 'obj', type: 'object' }]
      });

      method.invoke('ctx', { obj: 'test' }, function(err) {
        setImmediate(function() {
          expect(err).to.exist;
          expect(err.message).to.contain('invalid value for argument');
          expect(err.statusCode).to.equal(400);
          done();
        });
      });
    });

    it('resolves promise returned from the method', function(done) {
      var method = givenSharedMethod(
        function() {
          return new Promise(function(resolve, reject) {
            resolve(['one', 'two']);
          });
        },
        {
          returns: [
            { arg: 'first', type: 'string' },
            { arg: 'second', type: 'string' }
          ]
        });

      method.invoke('ctx', {}, function(err, result) {
        setImmediate(function() {
          expect(result).to.eql({ first: 'one', second: 'two' });
          done();
        });
      });
    });

    it('handles promise resolved with a single arg', function(done) {
      var method = givenSharedMethod(
        function() {
          return new Promise(function(resolve, reject) {
            resolve('data');
          });
        },
        {
          returns: [
            { arg: 'value', type: 'string' },
          ]
        });

      method.invoke('ctx', {}, function(err, result) {
        setImmediate(function() {
          expect(result).to.eql({ value: 'data' });
          done();
        });
      });
    });

    it('handles promise resolved with a single array arg', function(done) {
      var method = givenSharedMethod(
        function() {
          return new Promise(function(resolve, reject) {
            resolve(['a', 'b']);
          });
        },
        {
          returns: [
            { arg: 'value', type: ['string']},
          ]
        });

      method.invoke('ctx', {}, function(err, result) {
        setImmediate(function() {
          expect(result).to.eql({ value: ['a', 'b'] });
          done();
        });
      });
    });

    it('handles rejected promise returned from the method', function(done) {
      var testError = new Error('expected test error');
      var method = givenSharedMethod(function() {
        return new Promise(function(resolve, reject) {
          reject(testError);
        });
      });

      method.invoke('ctx', {}, function(err, result) {
        setImmediate(function() {
          expect(err).to.equal(testError);
          done();
        });
      });
    });

    function givenSharedMethod(fn, options) {
      if (options === undefined && typeof fn === 'object') {
        options = fn;
        fn = function() {
          arguments[arguments.length - 1]();
        };
      }

      var mockSharedClass = { fn: fn };
      return new SharedMethod(fn, 'fn', mockSharedClass, options);
    }
  });
});
