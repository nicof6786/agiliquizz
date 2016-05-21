Array.prototype.shuffle = function () {
  for (var i = this.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = this[i];
    this[i] = this[j];
    this[j] = temp;
  }
  return this;
};

var zeroPad = function(i) {
  var s = '' + i;
  while (s.length < 2) {
    s = '0' + s;
  }
  return s;
};

var app = angular.module('agiliquizz', [ 'ngMaterial', 'ngRoute', 'angularMoment' ]);

app.config(function($routeProvider) {
  $routeProvider.when('/', {
    templateUrl : 'static/templates/start.html',
    controller : 'StartCtrl'
  }).when('/load/:url', {
    templateUrl : 'static/templates/load.html',
    controller : 'LoadCtrl'
  }).when('/new', {
    templateUrl : 'static/templates/new.html',
    controller : 'NewCtrl'
  }).when('/question/:question', {
    templateUrl : 'static/templates/question.html',
    controller : 'QuestionCtrl'
  }).when('/result', {
    templateUrl : 'static/templates/result.html',
    controller : 'ResultCtrl'
  }).otherwise('/');
});

app.run(function(amMoment) {
  amMoment.changeLocale('fr');
});

app.controller('StartCtrl', function($scope, quizzSrv) {
  quizzSrv.clearQuizz();

  $scope.title = 'Bienvenue';
});

app.controller('LoadCtrl', function($location, $routeParams, $scope, quizzSrv) {
  quizzSrv.clearQuizz();

  $scope.title = 'Chargement...';

  quizzSrv.loadData($routeParams.url)
  .then(function() {
    $location.url('/new');
  }, function() {
    $location.url('/');
  });
});

app.controller('NewCtrl', function($location, $scope, quizzSrv) {
  if (!quizzSrv.hasData()) {
    return $location.url('/');
  }
  quizzSrv.clearQuizz();

  $scope.title = quizzSrv.getTitle();
  $scope.maxQuestions = quizzSrv.getMaxQuestions();
  $scope.questions = $scope.maxQuestions < 10 ? $scope.maxQuestions : 10;
  $scope.time = Math.ceil($scope.questions * 3 / 4);

  $scope.start = function() {
    quizzSrv.startQuizz($scope.questions, $scope.time);
    $location.url('/question/1');
  };
});

app.controller('QuestionCtrl', function($interval, $location, $routeParams, $scope, quizzSrv) {
  if (!quizzSrv.hasData()) {
    return $location.url('/');
  }
  if (!quizzSrv.hasQuizz()) {
    return $location.url('/new');
  }
  if (!quizzSrv.isQuizzRunning()) {
    return $location.url('/result');
  }

  $scope.title = quizzSrv.getTitle();
  $scope.question = quizzSrv.getQuestion($routeParams.question);

  if (!$scope.question) {
    //FIXME redirect vers résumé
    return $location.url('/new');
  }

  var rtInterval = $interval(function() {
    $scope.remainingTime = quizzSrv.getRemainingTime();
  }, 100);

  $scope.$on("$destroy", function() {
    $interval.cancel(rtInterval);
  });
});

app.controller('ResultCtrl', function() {

});

app.factory('quizzSrv', function($http, $location, $q, $timeout) {
  var srv = {};
  var data = null;
  var quizz = null;

  srv.loadData = function(url) {
    return $q(function(resolve, reject) {
      $http.get(decodeURIComponent(url)).
      then(function(response) {
        data = response.data;
        resolve();
      }, function() {
        reject();
      });
    });
  };

  srv.hasData = function() {
    return data !== null;
  };

  srv.getTitle = function() {
    return data.title;
  };

  srv.getMaxQuestions = function() {
    return data.questions.length;
  };

  srv.startQuizz = function(nQuestions, time) {
    quizz = {};

    quizz.questions = data.questions
    .slice(0)
    .shuffle()
    .slice(0, nQuestions)
    .map(function(question) {
      return { question : question };
    });

    quizz.endTime = moment().add(time, 'minutes');

    quizz.timeout = $timeout(function() {
      $location.url('/result');
    }, time * 60000);
  };

  srv.clearQuizz = function() {
    if (quizz) {
      $timeout.cancel(quizz.timeout);
    }
    quizz = null;
  };

  srv.hasQuizz = function() {
    return quizz !== null;
  };

  srv.isQuizzRunning = function() {
    return moment().isBefore(quizz.endTime);
  };

  srv.getRemainingTime = function() {
    var remainingTime = moment.duration(quizz.endTime.diff(moment()));
    return zeroPad(remainingTime.minutes()) + ':' + zeroPad(remainingTime.seconds());
  };

  srv.getQuestion = function(n) {
    return quizz.questions[n - 1];
  };

  return srv;
});
