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

  $scope.title = 'Agiliquizz';
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
  $scope.time = Math.ceil($scope.questions / 2);

  $scope.start = function() {
    quizzSrv.startQuizz($scope.questions, $scope.time);
    $location.url('/question/1');
  };
});

app.controller('QuestionCtrl', function($interval, $location, $routeParams, $scope, $mdDialog, quizzSrv) {
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
  $scope.nQuestion = parseInt($routeParams.question);
  $scope.question = quizzSrv.getQuestion($scope.nQuestion - 1);

  if (!$scope.question) {
    //TODO redirect vers résumé
    return $location.url('/new');
  }

  $scope.nQuestions = quizzSrv.getNQuestions();

  var updateRemainingTime = function() {
    $scope.remainingTime = quizzSrv.getRemainingTime();
  };
  updateRemainingTime();
  var rtInterval = $interval(updateRemainingTime, 100);

  $scope.hasPrevious = function() {
    return $scope.nQuestion !== 1;
  };

  $scope.previous = function() {
    $location.url("/question/" + ($scope.nQuestion - 1));
  };

  $scope.hasNext = function() {
    return $scope.nQuestion !== $scope.nQuestions;
  };

  $scope.next = function() {
    $location.url("/question/" + ($scope.nQuestion + 1));
  };

  $scope.toggle = function(value) {
    if (!Array.isArray($scope.question.answer)) {
      $scope.question.answer = [];
    }
    var index;
    if ((index = $scope.question.answer.indexOf(value)) === -1) {
      $scope.question.answer.push(value);
    } else {
      $scope.question.answer.splice(index, 1);
    }
    if ($scope.question.answer.length === 0) {
      delete $scope.question.answer;
    }
  };

  $scope.isChecked = function(value) {
    return $scope.question.answer && $scope.question.answer.indexOf(value) !== -1;
  };

  $scope.clearAnswer = function() {
    delete $scope.question.answer;
  };

  $scope.confirmDone = function(event) {
    var text = 'Êtes-vous certain d\'avoir terminer ?';
    var nUnanswered = quizzSrv.getNUnanswered();
    if (nUnanswered !== 0) {
      text += ' Vous avez ' + nUnanswered;
      if (nUnanswered === 1) {
        text += ' question non répondue.';
      } else {
        text += ' questions non répondues.';
      }
    }

    var confirm = $mdDialog.confirm()
          .title('Terminer ?')
          .textContent(text)
          .targetEvent(event)
          .ok('Oui')
          .cancel('Non');
    $mdDialog.show(confirm).then(function() {
      $location.url('/result');
    });
  };

  $scope.confirmCancel = function(event) {
    var confirm = $mdDialog.confirm()
          .title('Annuler ?')
          .textContent('Êtes vous certain de vouloir annuler ce quizz ?')
          .targetEvent(event)
          .ok('Oui')
          .cancel('Non');
    $mdDialog.show(confirm).then(function() {
      $location.url('/new');
    });
  };

  $scope.$on("$destroy", function() {
    $interval.cancel(rtInterval);
  });
});

app.controller('ResultCtrl', function($location, $scope, $mdDialog, quizzSrv) {
  if (!quizzSrv.hasData()) {
    return $location.url('/');
  }
  if (!quizzSrv.hasQuizz()) {
    return $location.url('/new');
  }

  quizzSrv.stopQuizz();

  $scope.title = quizzSrv.getTitle();
  $scope.result = quizzSrv.getResult();

  if (quizzSrv.quizzTimedOut()) {
    $mdDialog.show($mdDialog.alert()
          .title('Temps écoulé')
          .textContent('Le temps imparti est écoulé.')
          .ok('OK'));
  }
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
        data.questions.forEach(function(question) {
          if (Array.isArray(question.answer)) {
            question.answer.sort();
          }
        });
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
      quizz.timedOut = true;
      $location.url('/result');
    }, time * 60000);
  };

  srv.quizzTimedOut = function() {
    return quizz.timedOut === true;
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
    return quizz.questions[n];
  };

  srv.getNQuestions = function() {
    return quizz.questions.length;
  };

  srv.getNUnanswered = function() {
    var nUnanswered = 0;
    quizz.questions.forEach(function(question) {
      if (!question.answer) {
        nUnanswered++;
      }
    });
    return nUnanswered;
  };

  srv.stopQuizz = function() {
    $timeout.cancel(quizz.timeout);
    quizz.endTime = moment();
  };

  srv.getResult = function() {
    var result = { score : 0, questions : quizz.questions };
    result.questions.forEach(function(question) {
      if (question.answer) {
        question.answered = true;
      }
      if (question.answered) {
        if (Array.isArray(question.answer)) {
          question.answer.sort();
        }
        question.correctAnswer = angular.equals(question.answer, question.question.answer);
        if (question.correctAnswer) {
          result.score += 1;
        } else {
          result.score -= 0.5;
        }
      }
    });
    if (result.score < 0) {
      result.score = 0;
    }
    return result;
  };

  return srv;
});
