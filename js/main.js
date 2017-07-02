angular.module('invoicing',  ['cmGoogleApi'])

// The default logo for the invoice
.constant('DEFAULT_LOGO', 'images/metaware_logo.png')

// The invoice displayed when the user first uses the app
.constant('DEFAULT_INVOICE', {
  tax: 18.00,
  invoice_number: 10,
  transport_mode:'vehicle',
  vehicle_number:'TN04-2423',
  invoice_date:'',
  supply_date:'',
  reverse_charge:'Y',
  supply_place:'',
  state:'',
  state_code:'',
  ship_state:'',
  ship_state_code:'',
  bill_state:'',
  bill_state_code:'',
  bill_name:'',
  ship_name:'',
  bill_address:'',
  ship_address:'',
  bill_gstin:'',
  ship_gstin:'',
  customer_info: {
    name: 'Mr. John Doe',
    web_link: 'John Doe Designs Inc.',
    address1: '1 Infinite Loop',
    address2: 'Cupertino, California, US',
    address3: 'M5S 1B6',
	phone: 'Tel:5649494',
	gstid: 'GSTIN:345435'
  },
  company_info: {
    name: 'Metaware Labs',
    web_link: 'www.metawarelabs.com',
    address1: '123 Yonge Street',
    address2: 'Toronto, ON, Canada',
    address3: 'M5S 1B6',
	phone:'Tel:5649494',
	gstid:'GSTIN:345435'
  },
  items:[
    { qty: 10, description: 'Gadget', cost: 9.95 }
  ]
})


// Service for accessing local storage
.service('LocalStorage', [function() {

  var Service = {};

  // Returns true if there is a logo stored
  var hasLogo = function() {
    return !!localStorage['logo'];
  };

  // Returns a stored logo (false if none is stored)
  Service.getLogo = function() {
    if (hasLogo()) {
      return localStorage['logo'];
    } else {
      return false;
    }
  };

  Service.setLogo = function(logo) {
    localStorage['logo'] = logo;
  };

  // Checks to see if an invoice is stored
  var hasInvoice = function() {
    return !(localStorage['invoice'] == '' || localStorage['invoice'] == null);
  };

  // Returns a stored invoice (false if none is stored)
  Service.getInvoice = function() {
    if (hasInvoice()) {
      return JSON.parse(localStorage['invoice']);
    } else {
      return false;
    }
  };

  Service.setInvoice = function(invoice) {
    localStorage['invoice'] = JSON.stringify(invoice);
  };

  // Clears a stored logo
  Service.clearLogo = function() {
    localStorage['logo'] = '';
  };

  // Clears a stored invoice
  Service.clearinvoice = function() {
    localStorage['invoice'] = '';
  };

  // Clears all local storage
  Service.clear = function() {
    localStorage['invoice'] = '';
    Service.clearLogo();
  };

  return Service;

}])

.service('Currency', [function(){

  var service = {};

  service.all = function() {
    return [
      {
        name: 'Indian Rupee (र)',
        symbol: 'र'
      }
    ]
  }

  return service;
  
}])

// Main application controller
.controller('InvoiceCtrl', ['$scope', '$http', 'DEFAULT_INVOICE', 'DEFAULT_LOGO', 'LocalStorage', 'Currency',
  function($scope, $http, DEFAULT_INVOICE, DEFAULT_LOGO, LocalStorage, Currency, cmAuthService, cmApiService, googleClient) {
 
  	$scope.isSignedIn = false;
	$scope.user = "";  
	$scope.clientId ='598025943249-e0lk9nun0qsg054q3pi59his8eugsnjt.apps.googleusercontent.com'
	$scope.spreadsheetId ='1phQxiZXnFfZ0oz9llS3H88UD0D5o6QK5QKg5YaUQ0x0'
	var signInCallback = function(authResult) {
		// Here you can send code to the server,
		// to obtain access_token and refresh_token server side.
		// See https://developers.google.com/identity/sign-in/web/server-side-flow
		// and https://developers.google.com/identity/protocols/OAuth2WebServer
		 gapi.auth.authorize(
          {
            'client_id':'598025943249-e0lk9nun0qsg054q3pi59his8eugsnjt.apps.googleusercontent.com',
            'scope': 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.metadata.readonly',
            'immediate': true
          }, null);
	};

	// Listen for sign-in state changes. See https://developers.google.com/identity/sign-in/web/listeners
	$scope.signInListener = function(val){
		$scope.isSignedIn = val;
	};

	// Listen for changes to current user. See https://developers.google.com/identity/sign-in/web/listeners
	$scope.userListener = function(user){
		$scope.user = user.getBasicProfile().getName();
	};

	// Click Listener. If the user consent the scope, this function is called
	// Is the onSuccess function of GoogleAuth.attachClickHandler.
	// You need this if you want to grant offline access for your app
	// and get the access_token and the refresh_token server side.
	// See https://developers.google.com/identity/sign-in/web/server-side-flow
	// and https://developers.google.com/identity/sign-in/web/reference#googleauthattachclickhandlerwzxhzdk76containerwzxhzdk77_wzxhzdk78optionswzxhzdk79_wzxhzdk80onsuccesswzxhzdk81_wzxhzdk82onfailurewzxhzdk83
	$scope.clickHandler = function() {
		cmAuthService.getAuthInstance().then(function (auth2) {
			auth2.grantOfflineAccess({'redirect_uri': 'postmessage'}).then(signInCallback);
		});
	};

	// Log out the user without revoking all of the scopes that the user granted.
	$scope.logout = function(){
		cmAuthService.getAuthInstance().then(function (auth2) {
			auth2.signOut();
		});
	};

	// Log out the user and revokes all of the scopes that the user granted.
	$scope.disconnect = function(){
		cmAuthService.getAuthInstance().then(function (auth2) {
			auth2.disconnect();
		});
	};
  
  // Set defaults
  $scope.currencySymbol = 'र';
  $scope.logoRemoved = false;
  $scope.printMode   = false;

  (function init() {
    // Attempt to load invoice from local storage
    !function() {
      var invoice = LocalStorage.getInvoice();
      $scope.invoice = invoice ? invoice : DEFAULT_INVOICE;
    }();

    // Set logo to the one from local storage or use default
    !function() {
      var logo = LocalStorage.getLogo();
      $scope.logo = logo ? logo : DEFAULT_LOGO;
    }();

    $scope.availableCurrencies = Currency.all();

  })()
  // Adds an item to the invoice's items
  $scope.addItem = function() {
	  
	$scope.addBill();
    $scope.invoice.items.push({ qty:0, cost:0, description:"" });
  }

	$scope.addBill = function() {
		gapi.client.sheets.spreadsheets.values.update({
                    spreadsheetId:  $scope.spreadsheetId,
                    range: 'Sheet1!B2',
                    valueInputOption: 'USER_ENTERED',
					insertDataOption: "INSERT_ROWS",
                    values: [ ["123"] ]
        }).then(function(response) {
                    console.log(response);
		}); 
     
	}
  // Toggle's the logo
  $scope.toggleLogo = function(element) {
    $scope.logoRemoved = !$scope.logoRemoved;
    LocalStorage.clearLogo();
  };

  // Triggers the logo chooser click event
  $scope.editLogo = function() {
    // angular.element('#imgInp').trigger('click');
    document.getElementById('imgInp').click();
  };

  $scope.printInfo = function() {
    window.print();
  };

  // Remotes an item from the invoice
  $scope.removeItem = function(item) {
    $scope.invoice.items.splice($scope.invoice.items.indexOf(item), 1);
  };

  // Calculates the sub total of the invoice
  $scope.invoiceSubTotal = function() {
    var total = 0.00;
    angular.forEach($scope.invoice.items, function(item, key){
      total += (item.qty * item.cost);
    });
    return total;
  };

  // Calculates the tax of the invoice
  $scope.calculateTax = function() {
    return (($scope.invoice.tax * $scope.invoiceSubTotal())/100);
  };

  // Calculates the grand total of the invoice
  $scope.calculateGrandTotal = function() {
    saveInvoice();
    return $scope.calculateTax() + $scope.invoiceSubTotal();
  };

  // Clears the local storage
  $scope.clearLocalStorage = function() {
    var confirmClear = confirm('Are you sure you would like to clear the invoice?');
    if(confirmClear) {
      LocalStorage.clear();
      setInvoice(DEFAULT_INVOICE);
    }
  };

  // Sets the current invoice to the given one
  var setInvoice = function(invoice) {
    $scope.invoice = invoice;
    saveInvoice();
  };

  // Reads a url
  var readUrl = function(input) {
    if (input.files && input.files[0]) {
      var reader = new FileReader();
      reader.onload = function (e) {
        document.getElementById('company_logo').setAttribute('src', e.target.result);
        LocalStorage.setLogo(e.target.result);
      }
      reader.readAsDataURL(input.files[0]);
    }
  };

  // Saves the invoice in local storage
  var saveInvoice = function() {
    LocalStorage.setInvoice($scope.invoice);
  };

  // Runs on document.ready
  angular.element(document).ready(function () {
    // Set focus
    document.getElementById('invoice-number').focus();

    // Changes the logo whenever the input changes
    document.getElementById('imgInp').onchange = function() {
      readUrl(this);
    };
  });

}])
 
.config(function (googleClientProvider) {
	// Configure the provider.
	// Google Auth to login the user,
	// drive and youtube scope to make call to those services
	// pickerLibrary to use the picker
	googleClientProvider
		.loadGoogleAuth({
			cookie_policy: 'single_host_origin',
			fetch_basic_profile: true
		})
		
		.setClientId('598025943249-e0lk9nun0qsg054q3pi59his8eugsnjt.apps.googleusercontent.com')
/*		.addScope('https://www.googleapis.com/auth/drive.readonly')
		.addScope(' https://www.googleapis.com/auth/youtube')*/
		
        .addScope('https://www.googleapis.com/auth/spreadsheets')
		.addScope('https://www.googleapis.com/auth/drive.metadata.readonly')
		.addApi('drive', 'v4')
		.loadPickerLibrary();
});