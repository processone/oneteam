#line 1 "Sub/Exporter.pm"
package Sub::Exporter;

use strict;
use warnings;

use Carp ();
use Data::OptList ();
use Params::Util ();
use Sub::Install 0.92 ();

#line 22

our $VERSION = '0.974';

#line 375

# Given a potential import name, this returns the group name -- if it's got a
# group prefix.
sub _group_name {
  my ($name) = @_;

  return if (index q{-:}, (substr $name, 0, 1)) == -1;
  return substr $name, 1;
}

# \@groups is a canonicalized opt list of exports and groups this returns
# another canonicalized opt list with groups replaced with relevant exports.
# \%seen is groups we've already expanded and can ignore.
# \%merge is merged options from the group we're descending through.
sub _expand_groups {
  my ($class, $config, $groups, $collection, $seen, $merge) = @_;
  $seen  ||= {};
  $merge ||= {};
  my @groups = @$groups;

  for my $i (reverse 0 .. $#groups) {
    if (my $group_name = _group_name($groups[$i][0])) {
      my $seen = { %$seen }; # faux-dynamic scoping

      splice @groups, $i, 1,
        _expand_group($class, $config, $groups[$i], $collection, $seen, $merge);
    } else {
      # there's nothing to munge in this export's args
      next unless my %merge = %$merge;

      # we have things to merge in; do so
      my $prefix = (delete $merge{-prefix}) || '';
      my $suffix = (delete $merge{-suffix}) || '';

      if (
        Params::Util::_CODELIKE($groups[$i][1]) ## no critic Private
        or
        Params::Util::_SCALAR0($groups[$i][1]) ## no critic Private
      ) {
        # this entry was build by a group generator
        $groups[$i][0] = $prefix . $groups[$i][0] . $suffix;
      } else {
        my $as
          = ref $groups[$i][1]{-as} ? $groups[$i][1]{-as}
          :     $groups[$i][1]{-as} ? $prefix . $groups[$i][1]{-as} . $suffix
          :                           $prefix . $groups[$i][0]      . $suffix;

        $groups[$i][1] = { %{ $groups[$i][1] }, %merge, -as => $as };
      }
    }
  }

  return \@groups;
}

# \@group is a name/value pair from an opt list.
sub _expand_group {
  my ($class, $config, $group, $collection, $seen, $merge) = @_;
  $merge ||= {};

  my ($group_name, $group_arg) = @$group;
  $group_name = _group_name($group_name);

  Carp::croak qq(group "$group_name" is not exported by the $class module)
    unless exists $config->{groups}{$group_name};

  return if $seen->{$group_name}++;

  if (ref $group_arg) {
    my $prefix = (delete $merge->{-prefix}||'') . ($group_arg->{-prefix}||'');
    my $suffix = ($group_arg->{-suffix}||'') . (delete $merge->{-suffix}||'');
    $merge = {
      %$merge,
      %$group_arg,
      ($prefix ? (-prefix => $prefix) : ()),
      ($suffix ? (-suffix => $suffix) : ()),
    };
  }

  my $exports = $config->{groups}{$group_name};

  if (
    Params::Util::_CODELIKE($exports) ## no critic Private
    or
    Params::Util::_SCALAR0($exports) ## no critic Private
  ) {
    # I'm not very happy with this code for hiding -prefix and -suffix, but
    # it's needed, and I'm not sure, offhand, how to make it better.
    # -- rjbs, 2006-12-05
    my $group_arg = $group_arg ? { %$group_arg } : {};
    delete $group_arg->{-prefix};
    delete $group_arg->{-suffix};

    my $group = Params::Util::_CODELIKE($exports)
              ? $exports->($class, $group_name, $group_arg, $collection)
              : $class->$$exports($group_name, $group_arg, $collection);

    Carp::croak qq(group generator "$group_name" did not return a hashref)
      if ref $group ne 'HASH';

    my $stuff = [ map { [ $_ => $group->{$_} ] } keys %$group ];
    return @{
      _expand_groups($class, $config, $stuff, $collection, $seen, $merge)
    };
  } else {
    $exports
      = Data::OptList::mkopt($exports, "$group_name exports");

    return @{
      _expand_groups($class, $config, $exports, $collection, $seen, $merge)
    };
  }
}

# Given a config and pre-canonicalized importer args, remove collections from
# the args and return them.
sub _collect_collections {
  my ($config, $import_args, $class, $into) = @_;
  my %collection;

  my @collections
    = map  { splice @$import_args, $_, 1 }
      grep { exists $config->{collectors}{ $import_args->[$_][0] } }
      reverse 0 .. $#$import_args;

  my %seen;
  for my $collection (@collections) {
    my ($name, $value) = @$collection;

    Carp::croak "collection $name provided multiple times in import"
      if $seen{ $name }++;

    $collection{ $name } = $value;

    if (ref(my $hook = $config->{collectors}{$name})) {
      my $arg = {
        name        => $name,
        config      => $config,
        import_args => $import_args,
        class       => $class,
        into        => $into,
      };

      my $error_msg = "collection $name failed validation";
      if (Params::Util::_SCALAR0($hook)) {
        Carp::croak $error_msg unless $class->$$hook($value, $arg);
      } else {
        Carp::croak $error_msg unless $hook->($value, $arg);
      }
    }
  }

  return \%collection;
}

#line 554

# \%special is for experimental options that may or may not be kept around and,
# probably, moved to \%config.  These are also passed along to build_exporter.

sub setup_exporter {
  my ($config)  = @_;

  Carp::croak q(into and into_level may not both be supplied to exporter)
    if exists $config->{into} and exists $config->{into_level};

  my $as   = delete $config->{as}   || 'import';
  my $into
    = exists $config->{into}       ? delete $config->{into}
    : exists $config->{into_level} ? caller(delete $config->{into_level})
    :                                caller(0);

  my $import = build_exporter($config);

  Sub::Install::reinstall_sub({
    code => $import,
    into => $into,
    as   => $as,
  });
}

#line 589

sub _key_intersection {
  my ($x, $y) = @_;
  my %seen = map { $_ => 1 } keys %$x;
  my @names = grep { $seen{$_} } keys %$y;
}

# Given the config passed to setup_exporter, which contains sugary opt list
# data, rewrite the opt lists into hashes, catch a few kinds of invalid
# configurations, and set up defaults.  Since the config is a reference, it's
# rewritten in place.
my %valid_config_key;
BEGIN {
  %valid_config_key =
    map { $_ => 1 }
    qw(collectors exporter exports groups into into_level)
}

sub _rewrite_build_config {
  my ($config) = @_;

  if (my @keys = grep { not exists $valid_config_key{$_} } keys %$config) {
    Carp::croak "unknown options (@keys) passed to Sub::Exporter";
  }

  Carp::croak q(into and into_level may not both be supplied to exporter)
    if exists $config->{into} and exists $config->{into_level};

  for (qw(exports collectors)) {
    $config->{$_} = Data::OptList::mkopt_hash(
      $config->{$_},
      $_,
      [ 'CODE', 'SCALAR' ],
    );
  }

  if (my @names = _key_intersection(@$config{qw(exports collectors)})) {
    Carp::croak "names (@names) used in both collections and exports";
  }

  $config->{groups} = Data::OptList::mkopt_hash(
      $config->{groups},
      'groups',
      [
        'HASH',   # standard opt list
        'ARRAY',  # standard opt list
        'CODE',   # group generator
        'SCALAR', # name of group generation method
      ]
    );

  # by default, export nothing
  $config->{groups}{default} ||= [];

  # by default, build an all-inclusive 'all' group
  $config->{groups}{all} ||= [ keys %{ $config->{exports} } ];
}

sub build_exporter {
  my ($config) = @_;

  _rewrite_build_config($config);

  my $import = sub {
    my ($class) = shift;

    # XXX: clean this up -- rjbs, 2006-03-16
    my $special = (ref $_[0]) ? shift(@_) : {};
    Carp::croak q(into and into_level may not both be supplied to exporter)
      if exists $special->{into} and exists $special->{into_level};

    my $into
      = defined $special->{into}       ? delete $special->{into}
      : defined $special->{into_level} ? caller(delete $special->{into_level})
      : defined $config->{into}        ? $config->{into}
      : defined $config->{into_level}  ? caller($config->{into_level})
      :                                  caller(0);

    my $export = delete $special->{exporter}
              || $config->{exporter}
              || \&default_exporter;

    # this builds a AOA, where the inner arrays are [ name => value_ref ]
    my $import_args = Data::OptList::mkopt([ @_ ]);

    # is this right?  defaults first or collectors first? -- rjbs, 2006-06-24
    $import_args = [ [ -default => undef ] ] unless @$import_args;

    my $collection = _collect_collections($config, $import_args, $class, $into);

    my $to_import = _expand_groups($class, $config, $import_args, $collection);

    # now, finally $import_arg is really the "to do" list
    for (@$to_import) {
      _do_import($class, @$_, $collection, $config, $into, $export);
    }
  };

  return $import;
}

sub _do_import {
  my ($class, $name, $arg, $collection, $config, $into, $export) = @_;

  my ($generator, $as);

  if ($arg and Params::Util::_CODELIKE($arg)) { ## no critic
    # This is the case when a group generator has inserted name/code pairs.
    $generator = sub { $arg };
    $as = $name;
  } else {
    $arg = { $arg ? %$arg : () };

    Carp::croak qq("$name" is not exported by the $class module)
      unless (exists $config->{exports}{$name});

    $generator = $config->{exports}{$name};

    $as = exists $arg->{-as} ? (delete $arg->{-as}) : $name;
  }

  $export->($class, $generator, $name, $arg, $collection, $as, $into);
}

# XXX: Consider implementing a _export_args routine that takes the arguments to
# _export and returns a hash of named params.  This lets other people write
# exporters without tying me down to one set of @_ contents.  Maybe that's
# premature guarantee, though, unless I guarantee that @_ will never get
# /smaller/.

#line 730

sub default_exporter {
  my ($class, $generator, $name, $arg, $collection, $as, $into) = @_;
  _install(
    _generate($class, $generator, $name, $arg, $collection),
    $into,
    $as,
  );
}

## Cute idea, possibly for future use: also supply an "unimport" for:
## no Module::Whatever qw(arg arg arg);
# sub _unexport {
#   my (undef, undef, undef, undef, undef, $as, $into) = @_;
# 
#   if (ref $as eq 'SCALAR') {
#     undef $$as;
#   } elsif (ref $as) {
#     Carp::croak "invalid reference type for $as: " . ref $as;
#   } else {
#     no strict 'refs';
#     delete &{$into . '::' . $as};
#   }
# }

sub _generate {
  my ($class, $generator, $name, $arg, $collection) = @_;

  if (not defined $generator) {
    my $code = $class->can($name)
      or Carp::croak "can't locate exported subroutine $name via $class";
    return $code;
  }

  # I considered making this "$class->$generator(" but it seems that
  # overloading precedence would turn an overloaded-as-code generator object
  # into a string before code. -- rjbs, 2006-06-11
  return $generator->($class, $name, $arg, $collection)
    if Params::Util::_CODELIKE($generator);

  # This "must" be a scalar reference, to a generator method name.
  # -- rjbs, 2006-12-05
  return $class->$$generator($name, $arg, $collection);
}

sub _install {
  my ($code, $into, $as) = @_;
  # Allow as isa ARRAY to push onto an array?
  # Allow into isa HASH to install name=>code into hash?

  if (ref $as eq 'SCALAR') {
    $$as = $code;
  } elsif (ref $as) {
    Carp::croak "invalid reference type for $as: " . ref $as;
  } else {
    Sub::Install::reinstall_sub({ code => $code, into => $into, as => $as });
  }
}

#line 796

setup_exporter({
  exports => [
    qw(setup_exporter build_exporter),
    _import => sub { build_exporter($_[2]) },
  ],
  groups  => {
    all   => [ qw(setup_exporter build_export) ],
  },
  collectors => { -setup => \&_setup },
});

sub _setup {
  my ($value, $arg) = @_;

  if (ref $value eq 'HASH') {
    push @{ $arg->{import_args} }, [ _import => { -as => 'import', %$value } ];
    return 1;
  } elsif (ref $value eq 'ARRAY') {
    push @{ $arg->{import_args} },
      [ _import => { -as => 'import', exports => $value } ];
    return 1;
  }
  return;
}

#line 927

#line 964

"jn8:32"; # <-- magic true value
